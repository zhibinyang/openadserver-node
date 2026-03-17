/**
 * Test script to verify all creatives from seed data can be returned by ad requests.
 * This script tests each creative with appropriate request parameters based on:
 * - Creative type (slot_type)
 * - Dimensions (slot_width, slot_height)
 * - Targeting rules (geo, device, age, interest)
 */

import * as dotenv from 'dotenv';
dotenv.config();

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// Types
interface Creative {
    id: number;
    campaign_id: number;
    title: string;
    creative_type: number;
    width: number;
    height: number;
    duration?: number;
}

interface Campaign {
    id: number;
    name: string;
    advertiser_id: number;
    bid_type: number;
    pacing_type: number;
}

interface TargetingRule {
    campaign_id: number;
    rule_type: string;
    rule_value: any;
    is_include: boolean;
}

interface TestResult {
    creativeId: number;
    creativeTitle: string;
    campaignId: number;
    campaignName: string;
    creativeType: string;
    passed: boolean;
    error?: string;
    requestParams: any;
    responseCount: number;
}

// Creative type mapping
const CREATIVE_TYPE_NAMES: Record<number, string> = {
    1: 'BANNER',
    2: 'NATIVE',
    3: 'VIDEO',
    4: 'INTERSTITIAL',
    5: 'GEO_SNIPPET',
};

// Test user contexts for different targeting scenarios
const TEST_CONTEXTS = {
    // For campaigns with device targeting (android/ios)
    mobile_gamer: {
        os: 'android',
        device: 'Samsung Galaxy S21',
        browser: 'chrome',
        country: 'US',
        city: 'New York',
        age: 25,
        interests: ['gaming', 'tech'],
    },
    // For campaigns with US geo targeting
    us_user: {
        country: 'US',
        city: 'Los Angeles',
        os: 'ios',
        device: 'iPhone 14',
        browser: 'safari',
        age: 30,
        interests: ['shopping', 'tech'],
    },
    // For campaigns with UK/CA geo targeting
    uk_user: {
        country: 'UK',
        city: 'London',
        os: 'android',
        device: 'Pixel 7',
        browser: 'chrome',
        age: 28,
        interests: ['gaming'],
    },
    // For campaigns with age targeting (18-34)
    young_adult: {
        age: 25,
        country: 'US',
        os: 'android',
        device: 'Samsung Galaxy',
        browser: 'chrome',
        interests: ['gaming', 'tech'],
    },
    // For campaigns with age targeting (25-99)
    adult: {
        age: 35,
        country: 'US',
        os: 'ios',
        device: 'iPhone',
        browser: 'safari',
        interests: ['finance', 'investing'],
    },
    // For campaigns with interest targeting (programming, technology)
    developer: {
        age: 28,
        country: 'US',
        os: 'macos',
        device: 'MacBook Pro',
        browser: 'chrome',
        interests: ['programming', 'technology', 'coding'],
    },
    // For campaigns with no targeting (fallback)
    generic_user: {
        country: 'US',
        city: 'Seattle',
        os: 'windows',
        device: 'Desktop',
        browser: 'chrome',
        age: 30,
        interests: ['shopping', 'news'],
    },
    // For food delivery (US geo)
    food_user: {
        country: 'US',
        city: 'New York',
        os: 'ios',
        device: 'iPhone 14',
        browser: 'safari',
        age: 28,
        interests: ['food', 'shopping'],
    },
};

async function fetchFromDB<T>(query: string): Promise<T[]> {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const result = await pool.query(query);
        return result.rows as T[];
    } finally {
        await pool.end();
    }
}

async function postAdRequest(params: any): Promise<any> {
    const response = await fetch(`${API_BASE}/ad/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
}

/**
 * Determine the best test context for a campaign based on its targeting rules
 */
function getTestContextForCampaign(rules: TargetingRule[], campaignId: number): any {
    const campaignRules = rules.filter(r => r.campaign_id === campaignId);

    if (campaignRules.length === 0) {
        // No targeting rules - use generic user
        return TEST_CONTEXTS.generic_user;
    }

    // Build a context that satisfies all rules
    let context: any = { ...TEST_CONTEXTS.generic_user };

    for (const rule of campaignRules) {
        switch (rule.rule_type) {
            case 'geo':
                if (rule.rule_value.countries?.length > 0) {
                    context.country = rule.rule_value.countries[0];
                }
                if (rule.rule_value.cities?.length > 0) {
                    context.city = rule.rule_value.cities[0];
                }
                break;
            case 'device':
                if (rule.rule_value.os?.length > 0) {
                    context.os = rule.rule_value.os[0];
                }
                if (rule.rule_value.browser?.length > 0) {
                    context.browser = rule.rule_value.browser[0];
                }
                if (rule.rule_value.device?.length > 0) {
                    context.device = rule.rule_value.device[0];
                }
                break;
            case 'age':
                if (rule.rule_value.min && rule.rule_value.max) {
                    context.age = Math.floor((rule.rule_value.min + rule.rule_value.max) / 2);
                } else if (rule.rule_value.min) {
                    context.age = rule.rule_value.min + 5;
                }
                break;
            case 'interest':
                if (rule.rule_value.values?.length > 0) {
                    context.interests = rule.rule_value.values;
                }
                break;
        }
    }

    return context;
}

/**
 * Build ad request parameters for a creative
 */
function buildRequestParams(creative: Creative, context: any): any {
    const params: any = {
        slot_id: `test_slot_${creative.id}`,
        slot_type: creative.creative_type,
        slot_width: creative.width,
        slot_height: creative.height,
        user_id: `test_user_${Date.now()}`,
        ip: '8.8.8.8', // US IP
        num_ads: 10, // Request multiple candidates to increase chance of matching
        ...context,
    };

    // For video creatives, we might want to test VAST endpoint too
    // But for now, use the standard /ad/get endpoint

    return params;
}

async function main() {
    console.log('='.repeat(60));
    console.log('Ad Request Test Script');
    console.log('='.repeat(60));
    console.log(`API Base: ${API_BASE}`);
    console.log('');

    // 1. Fetch all creatives from database
    console.log('Fetching creatives from database...');
    const creatives = await fetchFromDB<Creative>(`
        SELECT id, campaign_id, title, creative_type, width, height, duration
        FROM creatives
        WHERE status = 1
        ORDER BY campaign_id, id
    `);
    console.log(`Found ${creatives.length} active creatives\n`);

    // 2. Fetch campaigns
    console.log('Fetching campaigns...');
    const campaigns = await fetchFromDB<Campaign>(`
        SELECT id, name, advertiser_id, bid_type, pacing_type
        FROM campaigns
        WHERE status = 1 AND is_active = true
    `);
    const campaignMap = new Map(campaigns.map(c => [c.id, c]));
    console.log(`Found ${campaigns.length} active campaigns\n`);

    // 3. Fetch targeting rules
    console.log('Fetching targeting rules...');
    const rules = await fetchFromDB<TargetingRule>(`
        SELECT campaign_id, rule_type, rule_value, is_include
        FROM targeting_rules
    `);
    console.log(`Found ${rules.length} targeting rules\n`);

    // 4. Test each creative
    const results: TestResult[] = [];
    let passCount = 0;
    let failCount = 0;

    console.log('Testing creatives...');
    console.log('-'.repeat(60));

    for (const creative of creatives) {
        const campaign = campaignMap.get(creative.campaign_id);
        if (!campaign) {
            console.log(`  Skipping creative ${creative.id}: campaign not found`);
            continue;
        }

        const context = getTestContextForCampaign(rules, creative.campaign_id);
        const params = buildRequestParams(creative, context);

        const result: TestResult = {
            creativeId: creative.id,
            creativeTitle: creative.title,
            campaignId: creative.campaign_id,
            campaignName: campaign.name,
            creativeType: CREATIVE_TYPE_NAMES[creative.creative_type] || `TYPE_${creative.creative_type}`,
            passed: false,
            requestParams: params,
            responseCount: 0,
        };

        try {
            const response = await postAdRequest(params);

            // Check if this creative is in the response
            const found = response.candidates?.some((ad: any) => ad.creative_id === creative.id);

            if (found) {
                result.passed = true;
                result.responseCount = response.candidates?.length || 0;
                passCount++;
                console.log(`  [PASS] Creative ${creative.id} (${creative.title})`);
            } else {
                result.passed = false;
                result.responseCount = response.candidates?.length || 0;
                result.error = 'Creative not found in response';
                failCount++;
                console.log(`  [FAIL] Creative ${creative.id} (${creative.title}) - not in response`);
                console.log(`         Campaign: ${campaign.name}`);
                console.log(`         Type: ${result.creativeType} (${creative.width}x${creative.height})`);
                console.log(`         Context: country=${context.country}, os=${context.os}, age=${context.age}`);
            }
        } catch (error: any) {
            result.error = error.message;
            failCount++;
            console.log(`  [ERROR] Creative ${creative.id} (${creative.title}) - ${error.message}`);
        }

        results.push(result);
    }

    // 5. Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total creatives tested: ${results.length}`);
    console.log(`Passed: ${passCount}`);
    console.log(`Failed: ${failCount}`);

    if (failCount > 0) {
        console.log('\nFailed creatives details:');
        console.log('-'.repeat(60));
        for (const r of results.filter(r => !r.passed)) {
            console.log(`\nCreative ${r.creativeId}: ${r.creativeTitle}`);
            console.log(`  Campaign: ${r.campaignName}`);
            console.log(`  Type: ${r.creativeType}`);
            console.log(`  Error: ${r.error}`);
            console.log(`  Request params: ${JSON.stringify(r.requestParams, null, 2).split('\n').join('\n    ')}`);
        }
    }

    // 6. Exit code
    process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
