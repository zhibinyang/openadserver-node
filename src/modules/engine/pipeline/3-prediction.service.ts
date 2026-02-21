
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
    model_type?: string;
}

@Injectable()
export class PredictionService implements PipelineStep, OnModuleInit {
    // Configurable defaults
    private readonly DEFAULT_CTR = 0.015;
    private readonly DEFAULT_CVR = 0.005;

    // ONNX Sessions
    private sessionCtr: any; // Use any to avoid TS issues with onnxruntime-node
    private sessionCvr: any;
    private featureConfig: FeatureConfig | null = null;

    private modelCtrPath = process.env.MODEL_CTR_PATH || path.join(process.cwd(), 'models', 'pctr_deepfm_model_latest.onnx');
    private modelCvrPath = process.env.MODEL_CVR_PATH || path.join(process.cwd(), 'models', 'pcvr_deepfm_model_latest.onnx');
    private readonly CONFIG_PATH = process.env.FEATURE_CONFIG_PATH || path.join(process.cwd(), 'models', 'feature_config_latest.json');

    private readonly logger = new Logger(PredictionService.name);

    async onModuleInit() {
        try {
            await this.loadConfigAndModels();
            this.setupWatchers();
        } catch (e) {
            this.logger.error(`[PredictionService] Failed to initialize:`, e);
        }
    }

    private async loadConfigAndModels() {
        // 1. Load Feature Config
        if (fs.existsSync(this.CONFIG_PATH)) {
            const rawConfig = fs.readFileSync(this.CONFIG_PATH, 'utf-8');
            this.featureConfig = JSON.parse(rawConfig);
            this.logger.log(`[PredictionService] Loaded feature config from ${this.CONFIG_PATH}`);
        } else {
            this.logger.warn(`[PredictionService] Feature config not found at ${this.CONFIG_PATH}. Using heuristic fallback.`);
        }

        await this.loadModels();
    }

    private async loadModels() {
        const ort = require('onnxruntime-node');

        // Load CTR Model
        if (fs.existsSync(this.modelCtrPath)) {
            try {
                this.sessionCtr = await ort.InferenceSession.create(this.modelCtrPath);
                this.logger.log(`[PredictionService] Loaded CTR ONNX model from ${this.modelCtrPath}`);
            } catch (err) {
                this.logger.error(`[PredictionService] Failed to load CTR ONNX model:`, err);
            }
        } else {
            this.logger.warn(`[PredictionService] CTR Model not found at ${this.modelCtrPath}. Using heuristic fallback.`);
        }

        // Load CVR Model
        if (fs.existsSync(this.modelCvrPath)) {
            try {
                this.sessionCvr = await ort.InferenceSession.create(this.modelCvrPath);
                this.logger.log(`[PredictionService] Loaded CVR ONNX model from ${this.modelCvrPath}`);
            } catch (err) {
                this.logger.error(`[PredictionService] Failed to load CVR ONNX model:`, err);
            }
        } else {
            this.logger.warn(`[PredictionService] CVR Model not found at ${this.modelCvrPath}. Using heuristic fallback.`);
        }
    }

    private setupWatchers() {
        // Watch Config
        fs.watchFile(this.CONFIG_PATH, { interval: 5000 }, async (curr, prev) => {
            if (curr.mtimeMs !== prev.mtimeMs) {
                this.logger.log(`[PredictionService] Feature config changed, reloading...`);
                await this.loadConfigAndModels();
            }
        });

        // Watch CTR Model
        if (this.modelCtrPath) {
            fs.watchFile(this.modelCtrPath, { interval: 5000 }, async (curr, prev) => {
                if (curr.mtimeMs !== prev.mtimeMs) {
                    this.logger.log(`[PredictionService] CTR Model file changed, reloading...`);
                    await this.loadModels();
                }
            });
        }

        // Watch CVR Model
        if (this.modelCvrPath) {
            fs.watchFile(this.modelCvrPath, { interval: 5000 }, async (curr, prev) => {
                if (curr.mtimeMs !== prev.mtimeMs) {
                    this.logger.log(`[PredictionService] CVR Model file changed, reloading...`);
                    await this.loadModels();
                }
            });
        }
    }

    async execute(
        candidates: AdCandidate[],
        context: UserContext,
    ): Promise<AdCandidate[]> {
        const start = Date.now();

        if (candidates.length === 0) {
            return candidates;
        }

        // If models or config not loaded, fallback to heuristics
        if (!this.sessionCtr || !this.sessionCvr || !this.featureConfig) {
            const results = this.heuristicPredict(candidates);
            this.logMetrics(results, Date.now() - start, 'heuristic_fallback_or_missing_model');
            return results;
        }

        try {
            // 1. Extract unified features for all candidates
            const { sparseTensor, denseTensor } = this.extractFeatures(candidates, context);

            const feeds = {
                sparse_inputs: sparseTensor, // Shared input names exported by python 
                dense_inputs: denseTensor,
            };

            if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_PREDICTION) {
                this.logger.debug(`[Inference Feeds] Sparse: [${sparseTensor.data.slice(0, 50).join(', ')}...]`);
                this.logger.debug(`[Inference Feeds] Dense:  [${denseTensor.data.slice(0, 10).join(', ')}...]`);
            }

            // 2. Run concurrent inference for CTR and CVR
            const [resultsCtr, resultsCvr] = await Promise.all([
                this.sessionCtr.run(feeds),
                this.sessionCvr.run(feeds)
            ]);

            // Output name is 'pctr' and 'pcvr' from python export script
            const outputCtr = resultsCtr.pctr || resultsCtr[this.sessionCtr.outputNames[0]];
            const pctrValues = outputCtr.data as Float32Array;

            const outputCvr = resultsCvr.pcvr || resultsCvr[this.sessionCvr.outputNames[0]];
            const pcvrValues = outputCvr.data as Float32Array;

            // 3. Assign scores
            for (let i = 0; i < candidates.length; i++) {
                candidates[i].pctr = Number(pctrValues[i]);
                candidates[i].pcvr = Number(pcvrValues[i]);
            }

            this.logMetrics(candidates, Date.now() - start, 'onnx_dual');

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

        const getValue = (feat: string, c: AdCandidate) => {
            switch (feat) {
                case 'user_id': return context.user_id;
                case 'campaign_id': return c.campaign_id;
                case 'creative_id': return c.creative_id;
                case 'slot_id': return context.slot_id;
                case 'req_hour': return reqHour;
                case 'req_dow': return reqDow;
                case 'banner_size': return `${c.width || 0}x${c.height || 0}`;
                case 'device': return context.device;
                case 'browser': return context.browser;
                case 'os': return context.os;
                case 'country': return context.country;
                case 'city': return context.city;
                case 'page_context': return context.page_context;
                case 'bid_type': return c.bid_type;
                case 'banner_width': return c.width || 0;
                case 'banner_height': return c.height || 0;
                case 'bid': return c.bid || 0;
                default: return 0;
            }
        };

        for (let i = 0; i < batchSize; i++) {
            const c = candidates[i];
            const offsetSparse = i * numSparse;
            const offsetDense = i * numDense;

            const rawSparse: Record<string, any> = {};
            const rawDense: Record<string, any> = {};

            // --- Sparse Features ---
            for (let j = 0; j < numSparse; j++) {
                const feat = config.sparse_features[j];
                const val = getValue(feat, c);
                if (i === 0) rawSparse[feat] = val;
                sparseData[offsetSparse + j] = this.encode(config, feat, val);
            }

            // --- Dense Features ---
            for (let j = 0; j < numDense; j++) {
                const feat = config.dense_features[j];
                const val = getValue(feat, c) as number;
                if (i === 0) rawDense[feat] = val;
                denseData[offsetDense + j] = this.scale(config, j, val);
            }

            if (i === 0 && (process.env.NODE_ENV !== 'production' || process.env.DEBUG_PREDICTION)) {
                this.logger.debug(`[Raw Features] Candidate 0 Sparse: ${JSON.stringify(rawSparse)}`);
                this.logger.debug(`[Raw Features] Candidate 0 Dense: ${JSON.stringify(rawDense)}`);
            }
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
            if (idx === -1) {
                this.logger.warn(`Feature ${featureName} is missing <UNK> class. Values: ${strVal}. Classes: ${classes}`);
                idx = 0; // Absolute fallback
            }
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
