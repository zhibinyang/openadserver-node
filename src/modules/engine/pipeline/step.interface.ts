
import { AdCandidate, UserContext } from '../../../shared/types';

export interface PipelineStep {
    execute(
        candidates: AdCandidate[],
        context: UserContext,
        extraArgs?: any,
    ): Promise<AdCandidate[]> | AdCandidate[]; // Support both sync and async
}
