
import * as maxmind from 'maxmind';
import * as path from 'path';

async function testGeoIP() {
    console.log('=== Testing MaxMind GeoIP ===\n');

    const dbPath = process.env.GEO_DB_PATH || path.join(process.cwd(), 'models', 'GeoLite2-Country.mmdb');
    console.log(`Loading DB from: ${dbPath}`);

    try {
        const lookup = await maxmind.open<maxmind.CountryResponse>(dbPath);
        console.log('DB Loaded successfully.\n');

        const testIPs = [
            { ip: '8.8.8.8', desc: 'Google DNS (US)' },
            { ip: '1.1.1.1', desc: 'Cloudflare DNS (AU/US depending on anycast)' },
            { ip: '202.96.128.86', desc: 'China Telecom (CN)' },
            { ip: '185.230.125.0', desc: 'European IP' },
            { ip: '127.0.0.1', desc: 'Localhost (Should be null)' }
        ];

        for (const test of testIPs) {
            const result = lookup.get(test.ip);
            console.log(`IP: ${test.ip} (${test.desc})`);

            if (result) {
                console.log(`    Country: ${result.country?.iso_code}`);
                console.log(`    Names: ${JSON.stringify(result.country?.names)}`);
            } else {
                console.log(`    Result: null (Correct for private/reserved IPs)`);
            }
            console.log('-'.repeat(40));
        }

    } catch (e) {
        console.error('Error during test:', e);
    }
}

testGeoIP();
