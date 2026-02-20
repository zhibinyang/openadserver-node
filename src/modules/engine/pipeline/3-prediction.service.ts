
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

    // ONNX Session
    private session: any; // Use any to avoid TS issues with onnxruntime-node
    private featureConfig: FeatureConfig | null = null;

    private modelPath = process.env.MODEL_PATH || '';
    private readonly CONFIG_PATH = process.env.FEATURE_CONFIG_PATH || path.join(process.cwd(), 'models', 'feature_config_latest.json');

    private readonly logger = new Logger(PredictionService.name);

    async onModuleInit() {
        try {
            await this.loadConfigAndModel();
            this.setupWatchers();
        } catch (e) {
            this.logger.error(`[PredictionService] Failed to initialize:`, e);
        }
    }

    private async loadConfigAndModel() {
        // 1. Load Feature Config
        if (fs.existsSync(this.CONFIG_PATH)) {
            const rawConfig = fs.readFileSync(this.CONFIG_PATH, 'utf-8');
            this.featureConfig = JSON.parse(rawConfig);
            this.logger.log(`[PredictionService] Loaded feature config from ${this.CONFIG_PATH}`);
        } else {
            this.logger.warn(`[PredictionService] Feature config not found at ${this.CONFIG_PATH}. Using heuristic fallback.`);
        }

        const oldModelPath = this.modelPath;
        // Determine MODEL_PATH based on model_type if not overridden by env
        if (!process.env.MODEL_PATH) {
            const modelType = this.featureConfig?.model_type || 'lr';
            this.modelPath = path.join(process.cwd(), 'models', `${modelType}_model_latest.onnx`);
        } else {
            this.modelPath = process.env.MODEL_PATH;
        }

        // Switch model watcher if path changed
        if (oldModelPath !== this.modelPath && oldModelPath) {
            fs.unwatchFile(oldModelPath);
            this.watchModelFile(); // Re-watch new path
        }

        await this.loadModel();
    }

    private async loadModel() {
        const ort = require('onnxruntime-node');
        if (fs.existsSync(this.modelPath)) {
            try {
                this.session = await ort.InferenceSession.create(this.modelPath);
                this.logger.log(`[PredictionService] Loaded ONNX model from ${this.modelPath} (Type: ${this.featureConfig?.model_type || 'lr'})`);
            } catch (err) {
                this.logger.error(`[PredictionService] Failed to load ONNX model:`, err);
            }
        } else {
            this.logger.warn(`[PredictionService] Model not found at ${this.modelPath}. Using heuristic fallback.`);
        }
    }

    private setupWatchers() {
        // Watch Config
        fs.watchFile(this.CONFIG_PATH, { interval: 5000 }, async (curr, prev) => {
            if (curr.mtimeMs !== prev.mtimeMs) {
                this.logger.log(`[PredictionService] Feature config changed, reloading...`);
                await this.loadConfigAndModel();
            }
        });

        // Watch Model
        this.watchModelFile();
    }

    private watchModelFile() {
        if (!this.modelPath) return;
        fs.watchFile(this.modelPath, { interval: 5000 }, async (curr, prev) => {
            if (curr.mtimeMs !== prev.mtimeMs) {
                this.logger.log(`[PredictionService] Model file changed, reloading...`);
                await this.loadModel();
            }
        });
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

            if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_PREDICTION) {
                this.logger.debug(`[Inference Feeds] Sparse: [${sparseTensor.data.slice(0, 50).join(', ')}...]`);
                this.logger.debug(`[Inference Feeds] Dense:  [${denseTensor.data.slice(0, 10).join(', ')}...]`);
            }

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
