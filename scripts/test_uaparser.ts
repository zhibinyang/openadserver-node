
import { UAParser } from 'ua-parser-js';

const testCases = [
    {
        desc: 'iPhone 13 / iOS 15 (Safari)',
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        expected: { os: 'iOS', device: 'iPhone' }
    },
    {
        desc: 'Android Pixel 5 (Chrome)',
        ua: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
        expected: { os: 'Android', device: 'Pixel 5' }
    },
    {
        desc: 'Windows 10 (Edge)',
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
        expected: { os: 'Windows' }
    },
    {
        desc: 'Mac OS (Chrome)',
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        expected: { os: 'Mac OS' }
    }
];

console.log('=== Testing UAParser.js v2 ===\n');

testCases.forEach((tc, i) => {
    // @ts-ignore
    const parser = new UAParser(tc.ua);
    const result = parser.getResult();

    console.log(`[${i + 1}] ${tc.desc}`);
    console.log(`    UA: ${tc.ua.substring(0, 60)}...`);
    console.log(`    Parsed OS: ${result.os.name} ${result.os.version}`);
    console.log(`    Parsed Device: ${result.device.type || 'desktop'} - ${result.device.vendor || ''} ${result.device.model || ''}`);
    console.log(`    Parsed Browser: ${result.browser.name} ${result.browser.version}`);

    if (result.os.name !== tc.expected.os) {
        console.error(`    FAILED: Expected OS ${tc.expected.os}, got ${result.os.name}`);
    } else {
        console.log('    PASS');
    }
    console.log('-'.repeat(40));
});
