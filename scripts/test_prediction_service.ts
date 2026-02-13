import { Test, TestingModule } from '@nestjs/testing';
import { PredictionService } from '../src/modules/engine/pipeline/3-prediction.service';
import { AdCandidate, BidType, CreativeType, UserContext } from '../src/shared/types';
import * as path from 'path';

async function main() {
    console.log('Testing PredictionService integration...');

    // Mock Context
    const context: UserContext = {
        user_id: 'test_user_123',
        os: 'ios',
        country: 'US',
        app_id: 'app_test',
        ip: '127.0.0.1',
        age: 25,
    };

    // Mock Candidates
    const candidates: AdCandidate[] = [
        {
            campaign_id: 101,
            creative_id: 201,
            advertiser_id: 301,
            bid: 1.5,
            bid_type: BidType.CPM,
            creative_type: CreativeType.BANNER,
            landing_url: 'http://example.com'
        },
        {
            campaign_id: 102,
            creative_id: 202,
            advertiser_id: 302,
            bid: 2.0,
            bid_type: BidType.CPC,
            creative_type: CreativeType.VIDEO,
            landing_url: 'http://example.com'
        }
    ];

    const service = new PredictionService();

    // Manual init to simulate OnModuleInit
    console.log('Initializing service...');
    await service.onModuleInit();

    console.log('Executing prediction...');
    const result = await service.execute(candidates, context);

    console.log('Results:');
    result.forEach((c, i) => {
        console.log(`Candidate ${i}: pCTR=${c.pctr}, pCVR=${c.pcvr}`);
    });

    // Check if pCTR is non-random (should be deterministic for same inputs)
    // Run again
    const result2 = await service.execute(candidates, context);
    if (result[0].pctr === result2[0].pctr) {
        console.log('SUCCESS: Prediction is deterministic (likely using model)');
    } else {
        console.error('FAILURE: Prediction is non-deterministic (likely using fallback random)');
    }
}

main().catch(console.error);
