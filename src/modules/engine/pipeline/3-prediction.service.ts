
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { PipelineStep } from './step.interface';
import { AdCandidate, UserContext } from '../../../shared/types';

interface FeatureConfig {
    sparse_features: string[];
    dense_features: string[];
    sparse_vocab_sizes: number[];
    dense_means: number[];
    dense_stds: number[];
    label_encoders: Record<string, string[]>;
}

@Injectable()
export class PredictionService implements PipelineStep, OnModuleInit {
    // Configurable defaults
    private readonly DEFAULT_CTR = 0.015;
    private readonly DEFAULT_CVR = 0.005;

    // ONNX Session
    private session: any; // Use any to avoid TS issues with onnxruntime-node
    private featureConfig: FeatureConfig | null = null;

    private readonly MODEL_PATH = process.env.MODEL_PATH || path.join(process.cwd(), 'models', 'lr_model_latest.onnx');
    private readonly CONFIG_PATH = process.env.FEATURE_CONFIG_PATH || path.join(process.cwd(), 'models', 'feature_config_latest.json');

    private readonly logger = new Logger(PredictionService.name);

    async onModuleInit() {
        try {
            // dynamic require to avoid build issues if lib is missing
            const ort = require('onnxruntime-node');

            // 1. Load Feature Config
            if (fs.existsSync(this.CONFIG_PATH)) {
                const rawConfig = fs.readFileSync(this.CONFIG_PATH, 'utf-8');
                this.featureConfig = JSON.parse(rawConfig);
                this.logger.log(`[PredictionService] Loaded feature config from ${this.CONFIG_PATH}`);
            } else {
                this.logger.warn(`[PredictionService] Feature config not found at ${this.CONFIG_PATH}. Using heuristic fallback.`);
            }

            // 2. Load ONNX Model
            if (fs.existsSync(this.MODEL_PATH)) {
                this.session = await ort.InferenceSession.create(this.MODEL_PATH);
                this.logger.log(`[PredictionService] Loaded ONNX model from ${this.MODEL_PATH}`);
            } else {
                this.logger.warn(`[PredictionService] Model not found at ${this.MODEL_PATH}. Using heuristic fallback.`);
            }

        } catch (e) {
            this.logger.error(`[PredictionService] Failed to initialize:`, e);
        }
    }

    async execute(
        candidates: AdCandidate[],
        context: UserContext,
    ): Promise<AdCandidate[]> {
        const start = Date.now();

        // If model or config not loaded, fallback to heuristics
        if (!this.session || !this.featureConfig) {
            const results = this.heuristicPredict(candidates);
            this.logMetrics(results, Date.now() - start, 'heuristic');
            return results;
        }

        try {
            // 1. Extract features for all candidates
            const { sparseTensor, denseTensor } = this.extractFeatures(candidates, context);

            // 2. Run inference
            const feeds = {
                sparse_inputs: sparseTensor, // Model input name matching export
                dense_inputs: denseTensor,
            };

            const results = await this.session.run(feeds);
            // Output name is 'pctr' from export script
            const outputTensor = results.pctr || results[this.session.outputNames[0]];
            const pctrValues = outputTensor.data as Float32Array;

            // 3. Assign scores
            for (let i = 0; i < candidates.length; i++) {
                candidates[i].pctr = Number(pctrValues[i]);
                // PCVR is not in this model yet, keep using heuristic/default
                candidates[i].pcvr = this.DEFAULT_CVR;
            }

            this.logMetrics(candidates, Date.now() - start, 'onnx');

        } catch (e) {
            this.logger.error('[PredictionService] Inference failed:', e);
            // Fallback on error
            const results = this.heuristicPredict(candidates);
            this.logMetrics(results, Date.now() - start, 'error_fallback');
            return results;
        }

        return candidates;
    }

    private logMetrics(candidates: AdCandidate[], duration: number, mode: string) {
        if (candidates.length === 0) return;
        const avgPctr = candidates.reduce((sum, c) => sum + (c.pctr || 0), 0) / candidates.length;
        this.logger.log(
            `Prediction finished in ${duration}ms (Mode: ${mode}). ` +
            `Items: ${candidates.length}, Avg pCTR: ${avgPctr.toFixed(4)}`
        );
    }

    private heuristicPredict(candidates: AdCandidate[]): AdCandidate[] {
        for (const candidate of candidates) {
            candidate.pctr = this.DEFAULT_CTR + (Math.random() * 0.01);
            candidate.pcvr = this.DEFAULT_CVR + (Math.random() * 0.002);
        }
        return candidates;
    }

    private extractFeatures(candidates: AdCandidate[], context: UserContext): { sparseTensor: any, denseTensor: any } {
        const ort = require('onnxruntime-node');
        const batchSize = candidates.length;
        const config = this.featureConfig!;

        const numSparse = config.sparse_features.length;
        const numDense = config.dense_features.length;

        // Flattened arrays for ONNX Tensor (BigInt64 for int64 inputs)
        const sparseData = new BigInt64Array(batchSize * numSparse);
        const denseData = new Float32Array(batchSize * numDense);

        const now = new Date();
        const reqHour = now.getHours(); // 0-23
        const reqDow = now.getDay() + 1; // JS(0-6) -> BQ(1-7)

        for (let i = 0; i < batchSize; i++) {
            const c = candidates[i];
            const offsetSparse = i * numSparse;
            const offsetDense = i * numDense;

            // --- Sparse Features ---
            // Mapping logic: value -> string -> index in label_encoders
            // Config keys: "user_id", "campaign_id", ...

            // 1. user_id
            sparseData[offsetSparse + 0] = this.encode(config, 'user_id', context.user_id);
            // 2. campaign_id
            sparseData[offsetSparse + 1] = this.encode(config, 'campaign_id', c.campaign_id);
            // 3. creative_id
            sparseData[offsetSparse + 2] = this.encode(config, 'creative_id', c.creative_id);
            // 4. slot_id
            sparseData[offsetSparse + 3] = this.encode(config, 'slot_id', context.slot_id);
            // 5. device
            sparseData[offsetSparse + 4] = this.encode(config, 'device', context.device);
            // 6. browser
            sparseData[offsetSparse + 5] = this.encode(config, 'browser', context.browser);
            // 7. os
            sparseData[offsetSparse + 6] = this.encode(config, 'os', context.os);
            // 8. country
            sparseData[offsetSparse + 7] = this.encode(config, 'country', context.country);
            // 9. city
            sparseData[offsetSparse + 8] = this.encode(config, 'city', context.city);
            // 10. page_context
            sparseData[offsetSparse + 9] = this.encode(config, 'page_context', context.page_context);
            // 11. bid_type
            sparseData[offsetSparse + 10] = this.encode(config, 'bid_type', c.bid_type);

            // --- Dense Features ---
            // 1. banner_width
            denseData[offsetDense + 0] = this.scale(config, 0, c.width || 0);
            // 2. banner_height
            denseData[offsetDense + 1] = this.scale(config, 1, c.height || 0);
            // 3. bid
            denseData[offsetDense + 2] = this.scale(config, 2, c.bid || 0);
            // 4. req_hour
            denseData[offsetDense + 3] = this.scale(config, 3, reqHour);
            // 5. req_dow
            denseData[offsetDense + 4] = this.scale(config, 4, reqDow);
        }

        const sparseTensor = new ort.Tensor('int64', sparseData, [batchSize, numSparse]);
        const denseTensor = new ort.Tensor('float32', denseData, [batchSize, numDense]);

        return { sparseTensor, denseTensor };
    }

    private encode(config: FeatureConfig, featureName: string, value: any): bigint {
        const classes = config.label_encoders[featureName];
        if (!classes) return BigInt(0); // Should not happen if config is correct

        const strVal = String(value ?? 'unknown'); // Convert to string, handle null/undefined
        let idx = classes.indexOf(strVal);

        if (idx === -1) {
            // Fallback to <UNK>
            idx = classes.indexOf('<UNK>');
            if (idx === -1) idx = 0; // Absolute fallback
        }
        return BigInt(idx);
    }

    private scale(config: FeatureConfig, featureIndex: number, value: number): number {
        const mean = config.dense_means[featureIndex];
        const std = config.dense_stds[featureIndex];
        // Standard Scaler: (x - mean) / std
        // Avoid division by zero if std is 0 (constant feature)
        if (std === 0) return 0;
        return (value - mean) / std;
    }
}
