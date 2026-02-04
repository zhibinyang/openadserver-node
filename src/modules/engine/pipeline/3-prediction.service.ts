
import { Injectable } from '@nestjs/common';
import { PipelineStep } from './step.interface';
import { AdCandidate, UserContext } from '../../../shared/types';

@Injectable()
export class PredictionService implements PipelineStep {
    // Configurable defaults
    private readonly DEFAULT_CTR = 0.015;
    private readonly DEFAULT_CVR = 0.005;

    async execute(
        candidates: AdCandidate[],
        _context: UserContext,
    ): Promise<AdCandidate[]> {
        // In a real system, we would batch call ONNX Runtime here.
        // For now, we simulate Statistical Prediction.

        // We modify candidates in-place or return new objects. 
        // In-place is faster for JS array references.

        for (const candidate of candidates) {
            // TODO: Load real historical stats from CacheService -> HourlyStats
            // For now, we apply a base score + random noise to simulate 'AI' variation
            // This ensures the ranking isn't always identical for testing.

            candidate.pctr = this.DEFAULT_CTR + (Math.random() * 0.01);
            candidate.pcvr = this.DEFAULT_CVR + (Math.random() * 0.002);
        }

        return candidates;
    }
}
