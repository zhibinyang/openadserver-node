
// @ts-ignore
require('dotenv').config();

import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { EventType } from '../src/shared/types';
import { randomUUID } from 'crypto';

async function verifyTracking() {
    console.log('=== Verifying Request & Click Tracking ===');

    const service = new AnalyticsService(null as any);

    const requestId = randomUUID();
    const clickId = randomUUID();
    const campaignId = 12345;
    const creativeId = 67890;

    // 1. Simulate REQUEST Event (from EngineController)
    console.log('[STEP 1] Tracking REQUEST Event (Full Context)...');
    service.trackEvent({
        request_id: requestId,
        click_id: clickId,
        campaign_id: campaignId,
        creative_id: creativeId,
        user_id: 'user_001',
        device: 'iPhone 13',
        browser: 'Safari',
        event_type: EventType.REQUEST, // 9
        event_time: Date.now(),
        cost: 0,
        ip: '203.0.113.1',
        country: 'US',
        city: 'San Francisco',
        bid: 1.5,
        price: 1.5,
    });

    // 2. Simulate CLICK Event (from TrackingService - Lightweight)
    console.log('[STEP 2] Tracking CLICK Event (Lightweight Context)...');
    service.trackEvent({
        request_id: '',       // Unknown in lightweight tracking
        click_id: clickId,    // Known!
        campaign_id: 0,       // Unknown
        creative_id: 0,       // Unknown
        user_id: '',          // Unknown
        event_type: EventType.CLICK, // 2
        event_time: Date.now() + 5000, // 5 seconds later
        cost: 0,
        ip: undefined,        // Maybe known from request IP
        country: undefined,
        city: undefined,
        device: undefined,    // Unknown
        browser: undefined,   // Unknown
        bid: 0,
        price: 0,
    });

    // 3. Force Flush
    console.log('[STEP 3] Flushing to BigQuery...');
    try {
        // Access private flush method or just rely on buffer limit?
        // Let's use 'any' cast to call flush directly for immediate test.
        await (service as any).flush();
        console.log('[SUCCESS] Events flushed successfully.');
        console.log(`  -> Request ID: ${requestId}`);
        console.log(`  -> Click ID: ${clickId}`);
        console.log('  -> Please verify in BigQuery that you see 2 rows:');
        console.log('     1. REQUEST event with full context.');
        console.log('     2. CLICK event with null context but matching click_id.');
    } catch (error) {
        console.error('[FAILURE] Flush failed:', error);
        process.exit(1);
    }
}

verifyTracking().catch(err => {
    console.error('Script Error:', err);
    process.exit(1);
});
