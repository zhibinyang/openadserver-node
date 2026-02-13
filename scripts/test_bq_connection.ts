
// @ts-ignore
require('dotenv').config();

import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { EventType } from '../src/shared/types';
import { randomUUID } from 'crypto';

async function testConnection() {
    console.log('=== BigQuery Connection Verification ===');

    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const dataset = process.env.BQ_DATASET || 'analytics';
    const table = process.env.BQ_TABLE || 'ad_events';

    console.log('[CONFIG] Project ID:', projectId || '(Not Set - using default?)');
    console.log('[CONFIG] Credentials:', creds || '(Not Set - relying on default auth)');
    console.log('[CONFIG] Dataset:', dataset);
    console.log('[CONFIG] Table:', table);

    if (!projectId && !creds) {
        console.warn('[WARN] No Project ID or Credentials set. Connection will likely fail unless using ambient credentials (e.g. GCE/Cloud Run).');
    }

    console.log('\n[STEP 1] Initializing AnalyticsService...');
    const service = new AnalyticsService(null as any);

    console.log('[STEP 2] Attempting to write ONE test row...');

    const testEvent = {
        request_id: randomUUID(),
        click_id: 'test_click_' + Date.now(),
        campaign_id: 999999, // Test ID
        creative_id: 888888, // Test ID
        user_id: 'test_user',
        device: 'Test Device Verification Script',
        browser: 'NodeJS Script',
        event_type: EventType.IMPRESSION,
        event_time: Date.now(),
        cost: 0.001,
        ip: '127.0.0.1',
        country: 'US',
        city: 'Test City',
        bid: 0.5,
        price: 0.5,
    };

    try {
        // We access the private method via 'any' cast or just use public trackEvent + force flush?
        // Public trackEvent buffers. We want immediate feedback.
        // Let's use the public method then trigger flush manually if possible, or wait.
        // AnalyticsService flushes every 60s or 50 items.
        // Waiting 60s is annoying.
        // We can access private 'writeToBigQuery' via 'any' cast for testing.

        console.log('Writing row...');
        await (service as any).writeToBigQuery([testEvent]);

        console.log('\n[SUCCESS] Successfully wrote test row to BigQuery!');
        console.log('  -> Please check the table preview in GCP Console to confirm data arrival.');
        console.log('  -> Note: Streaming buffer data is available immediately for query, but may take time to show in preview/export.');

    } catch (error: any) {
        console.error('\n[FAILURE] Connection Failed.');
        console.error('Error Details:', error.message);

        if (error.code === 5 || error.message.includes('not found')) {
            console.error('\n[DIAGNOSIS] Resource Not Found');
            console.error('  - Check if Project ID is correct.');
            console.error('  - Check if Dataset "analytics" exists.');
            console.error('  - Check if Table "ad_events" exists.');
        } else if (error.code === 7 || error.message.includes('Permission') || error.message.includes('credentials')) {
            console.error('\n[DIAGNOSIS] Permission Denied / Auth Error');
            console.error('  - Check GOOGLE_APPLICATION_CREDENTIALS path.');
            console.error('  - Check if Service Account has "BigQuery Data Editor" role.');
        } else if (error.message.includes('schema') || error.message.includes('mismatch')) {
            console.error('\n[DIAGNOSIS] Schema Mismatch');
            console.error('  - The local Protobuf definition does not match the BigQuery table schema.');
            console.error('  - Ensure columns in BQ match the proto definition in AnalyticsService.');
        } else {
            console.error('\n[DIAGNOSIS] Unknown Error');
            console.error('  - Check network connectivity.');
            console.error('  - Check quotas.');
        }

        process.exit(1);
    }
}

testConnection().catch(err => {
    console.error('Unexpected script error:', err);
    process.exit(1);
});
