
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as path from 'path';
import { PipelineStep } from './step.interface';
import { AdCandidate, UserContext } from '../../../shared/types';

@Injectable()
export class PredictionService implements PipelineStep, OnModuleInit {
    // Configurable defaults
    private readonly DEFAULT_CTR = 0.015;
    private readonly DEFAULT_CVR = 0.005;

    // ONNX Session
    private session: any; // Use any to avoid TS issues with onnxruntime-node
    private readonly MODEL_PATH = path.join(process.cwd(), 'models', 'lr_ctr.onnx');

    async onModuleInit() {
        try {
            // dynamic require to avoid build issues if lib is missing
            const ort = require('onnxruntime-node');
            this.session = await ort.InferenceSession.create(this.MODEL_PATH);
            console.log(`[PredictionService] Loaded ONNX model from ${this.MODEL_PATH}`);
        } catch (e) {
            console.error(`[PredictionService] Failed to load ONNX model:`, e);
            console.warn(`[PredictionService] Falling back to heuristic prediction.`);
        }
    }

    private readonly logger = new Logger(PredictionService.name);

    async execute(
        candidates: AdCandidate[],
        context: UserContext,
    ): Promise<AdCandidate[]> {
        const start = Date.now();

        // If model not loaded, fallback to heuristics
        if (!this.session) {
            const results = this.heuristicPredict(candidates);
            this.logMetrics(results, Date.now() - start, 'heuristic');
            return results;
        }

        try {
            // 1. Extract features for all candidates
            const { sparseTensor, denseTensor } = this.extractFeatures(candidates, context);

            // 2. Run inference
            const feeds = {
                sparse_features: sparseTensor,
                dense_features: denseTensor,
            };

            const results = await this.session.run(feeds);
            const outputTensor = results[this.session.outputNames[0]];
            const pctrValues = outputTensor.data as Float32Array;

            // 3. Assign scores
            for (let i = 0; i < candidates.length; i++) {
                candidates[i].pctr = Number(pctrValues[i]);
                // PCVR is not in this model yet, keep using heuristic/default
                candidates[i].pcvr = this.DEFAULT_CVR;
            }

            this.logMetrics(candidates, Date.now() - start, 'onnx');

        } catch (e) {
            console.error('[PredictionService] Inference failed:', e);
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
        // Model schema: 26 sparse, 13 dense
        const numSparse = 26;
        const numDense = 13;

        // Vocab sizes from e2e_test_lr.py
        const vocabSizes = [
            1000, 500, 200, 100, 50,  // C1-C5
            300, 200, 100, 1000, 500,  // C6-C10
            200, 100, 50, 500, 300,  // C11-C15
            200, 100, 50, 1000, 500,  // C16-C20
            200, 100, 50, 300, 200, 100,  // C21-C26
        ];

        const sparseData = new BigInt64Array(batchSize * numSparse);
        const denseData = new Float32Array(batchSize * numDense);

        for (let i = 0; i < batchSize; i++) {
            const candidate = candidates[i];
            const offsetSparse = i * numSparse;
            const offsetDense = i * numDense;

            // --- Sparse Features (Hashing) ---
            sparseData[offsetSparse + 0] = BigInt(candidate.campaign_id % vocabSizes[0]); // C1
            sparseData[offsetSparse + 1] = BigInt(candidate.creative_id % vocabSizes[1]); // C2
            sparseData[offsetSparse + 2] = BigInt(candidate.advertiser_id % vocabSizes[2]); // C3
            sparseData[offsetSparse + 3] = this.hashString(context.user_id || '', vocabSizes[3]); // C4
            sparseData[offsetSparse + 4] = this.hashString(context.app_id || '', vocabSizes[4]); // C5
            sparseData[offsetSparse + 5] = this.hashString(context.os || '', vocabSizes[5]); // C6
            sparseData[offsetSparse + 6] = this.hashString(context.country || '', vocabSizes[6]); // C7

            // Fill distinct rest with some derived values or 0
            for (let j = 7; j < numSparse; j++) {
                sparseData[offsetSparse + j] = BigInt(j % vocabSizes[j]);
            }

            // --- Dense Features ---
            // 0: age
            // 1: bid
            // ... others
            denseData[offsetDense + 0] = context.age ? context.age / 100.0 : 0.3; // Normalize age
            denseData[offsetDense + 1] = candidate.bid;

            // Fill rest
            for (let j = 2; j < numDense; j++) {
                denseData[offsetDense + j] = 0.0;
            }
        }

        const sparseTensor = new ort.Tensor('int64', sparseData, [batchSize, numSparse]);
        const denseTensor = new ort.Tensor('float32', denseData, [batchSize, numDense]);

        return { sparseTensor, denseTensor };
    }

    private hashString(str: string, modulo: number): bigint {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return BigInt(Math.abs(hash) % modulo);
    }
}
