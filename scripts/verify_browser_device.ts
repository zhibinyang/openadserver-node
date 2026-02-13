
import { UAParser } from 'ua-parser-js';

// Mock UserContext interface
interface UserContext {
    os: string;
    device?: string;
    browser?: string;
}

// 1. Simulation of EngineController.buildContext logic
function simulateBuildContext(headers: any, dto: any): UserContext {
    const context: UserContext = {
        os: dto.os || 'unknown',
        device: dto.device,
        browser: dto.browser,
    };

    if (context.os === 'unknown' || !context.device || !context.browser) {
        try {
            // @ts-ignore
            const parser = new UAParser(headers);
            const result = parser.getResult();

            if (context.os === 'unknown' && result.os.name) {
                context.os = result.os.name;
            }

            if (!context.device && result.device.model) {
                context.device = [result.device.vendor, result.device.model].filter(Boolean).join(' ');
            }

            if (!context.browser && result.browser.name) {
                context.browser = result.browser.name;
            }
        } catch (e) { }
    }
    return context;
}

// 2. Simulation of TargetingMatcher logic
function simulateTargeting(rule: any, context: UserContext): boolean {
    let matched = true;

    if (rule.browser && Array.isArray(rule.browser)) {
        if (!context.browser || !rule.browser.includes(context.browser.toLowerCase())) {
            matched = false;
        }
    }

    if (matched && rule.device && Array.isArray(rule.device)) {
        // Partial match logic
        if (!context.device) {
            matched = false;
        } else {
            const deviceLower = context.device.toLowerCase();
            const anyMatch = rule.device.some((d: string) => deviceLower.includes(d.toLowerCase()));
            if (!anyMatch) matched = false;
        }
    }

    return matched;
}

// Test Cases
const testCases = [
    {
        name: 'DTO Priority',
        headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)...' }, // Should be ignored for OS/Device if DTO present
        dto: { os: 'ManualOS', device: 'ManualDevice', browser: 'ManualBrowser' },
        expectedContext: { os: 'ManualOS', device: 'ManualDevice', browser: 'ManualBrowser' }
    },
    {
        name: 'UA Fallback (iPhone)',
        headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1' },
        dto: {},
        expectedContext: { os: 'iOS', device: 'Apple iPhone', browser: 'Mobile Safari' }
    },
    {
        name: 'UA Fallback (Chrome Desktop)',
        headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        dto: {},
        expectedContext: { os: 'Mac OS', device: undefined, browser: 'Chrome' } // Desktop usually has no device model in UA
    }
];

console.log('=== Verifying Context Building ===\n');
testCases.forEach(tc => {
    const ctx = simulateBuildContext(tc.headers, tc.dto);
    console.log(`[${tc.name}]`);
    console.log(`  Expected: ${JSON.stringify(tc.expectedContext)}`);
    console.log(`  Actual:   ${JSON.stringify(ctx)}`);

    // Simple verification
    let pass = true;
    if (ctx.os !== tc.expectedContext.os) pass = false;
    if (ctx.device !== tc.expectedContext.device) pass = false;
    if (ctx.browser !== tc.expectedContext.browser) pass = false;

    console.log(`  Result:   ${pass ? 'PASS' : 'FAIL'}`);
    console.log('-'.repeat(40));
});

console.log('\n=== Verifying Targeting Logic ===\n');
const targetingTests = [
    {
        name: 'Browser Target: Chrome (Match)',
        rule: { browser: ['chrome', 'edge'] },
        context: { os: 'Mac OS', browser: 'Chrome' },
        expected: true
    },
    {
        name: 'Browser Target: Safari (No Match)',
        rule: { browser: ['safari'] },
        context: { os: 'Mac OS', browser: 'Chrome' },
        expected: false
    },
    {
        name: 'Device Target: iPhone (Match Partial)',
        rule: { device: ['iphone'] },
        context: { os: 'iOS', device: 'Apple iPhone' },
        expected: true
    },
    {
        name: 'Device Target: Pixel (No Match)',
        rule: { device: ['pixel'] },
        context: { os: 'iOS', device: 'Apple iPhone' },
        expected: false
    }
];

targetingTests.forEach(tc => {
    const res = simulateTargeting(tc.rule, tc.context as UserContext);
    console.log(`[${tc.name}]`);
    console.log(`  Rule: ${JSON.stringify(tc.rule)}`);
    console.log(`  Ctx:  ${JSON.stringify(tc.context)}`);
    console.log(`  Result: ${res} (Expected: ${tc.expected})`);
    console.log(`  Check:  ${res === tc.expected ? 'PASS' : 'FAIL'}`);
    console.log('-'.repeat(40));
});
