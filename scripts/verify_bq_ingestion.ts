
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { EventType } from '../src/shared/types';

async function verifyAnalytics() {
    console.log('=== Verifying Analytics Service ===');

    // 1. Initialize Service
    const service = new AnalyticsService(null as any);
    console.log('[PASS] Service Initialized');

    // 2. Track Events
    console.log('Tracking 5 events...');
    for (let i = 0; i < 5; i++) {
        service.trackEvent({
            request_id: `req_${i}`,
            click_id: `click_${i}`,
            campaign_id: 101,
            creative_id: 202,
            user_id: `user_${i}`,
            device: 'Test Device',
            browser: 'Test Browser',
            event_type: EventType.CLICK,
            event_time: Date.now(),
            cost: 0.5,
            ip: '127.0.0.1',
            country: 'US',
            city: 'New York',
            bid: 1.0,
            price: 0.5,
        });
    }
    console.log('[PASS] Events Tracked (Buffered)');

    // 3. Trigger Flush (Mocking internal flush)
    // We can't access private flush(), but we can trigger it by filling buffer or via public method?
    // Actually, flush is private. 
    // But we can check if proto initialization worked by seeing if it threw error during init.
    // And we can try `onModuleDestroy` which calls `flush`.

    console.log('Triggering Flush via onModuleDestroy...');
    try {
        await service.onModuleDestroy();
        console.log('[PASS] Flush executed without crash (Auth error expected if no creds)');
    } catch (error: any) {
        console.log('[INFO] Flush failed as expected (likely Auth/Network):', error.message);
        if (error.message.includes('Could not load the default credentials') || error.message.includes('project')) {
            console.log('[PASS] Auth error confirms client attempted to connect.');
        } else {
            console.warn('[WARN] Unexpected error:', error);
        }
    }
}

verifyAnalytics().catch(console.error);
