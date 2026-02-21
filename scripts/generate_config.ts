const API_BASE = 'http://localhost:3000/api/v1';

async function postData(url: string, data: any) {
    const response = await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
}

async function main() {
    try {
        console.log('1. Creating Advertiser...');
        const advData = await postData('/advertisers', {
            name: 'Generated Advertiser',
            company: 'AutoGen Inc.',
            status: 1,
            daily_budget: '0',
            balance: '5000000'
        });
        const advertiserId = advData.id;
        console.log(`✅ Advertiser created with ID: ${advertiserId}`);

        console.log('\n2. Creating Campaign...');
        const campData = await postData('/campaigns', {
            advertiser_id: advertiserId,
            name: 'Generated Auto Campaign',
            budget_daily: '1000',
            budget_total: '50000',
            bid_type: 4, // 4 = oCPM
            bid_amount: '2.50',
            pacing_type: 1, // 1 = Even
            freq_cap_daily: 10,
            freq_cap_hourly: 3,
            start_time: new Date().toISOString(),
            end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 days
            status: 1
        });
        const campaignId = campData.id;
        console.log(`✅ Campaign created with ID: ${campaignId}`);

        console.log('\n3. Creating Targeting Rules...');
        await postData('/targeting_rules', {
            campaign_id: campaignId,
            rule_type: 'geo',
            rule_value: {
                countries: ["US", "CN", "JP", "IN", "SG", "GB", "DE", "FR"]
            },
            is_include: true
        });
        console.log(`✅ Targeting rules created for Campaign ${campaignId}`);

        console.log('\n4. Creating 5 Creatives...');

        const banners = [
            { width: 300, height: 250, title: 'Gen Banner 300x250', url: 'https://res.cloudinary.com/dr6wljwzj/image/upload/v1771551520/laptop_ad_300x250_pwydnm.jpg' },
            { width: 300, height: 600, title: 'Gen Banner 300x600', url: 'https://res.cloudinary.com/dr6wljwzj/image/upload/v1771551520/laptop_ad_300x600_vikk2w.jpg' },
            { width: 320, height: 50, title: 'Gen Banner 320x50', url: 'https://res.cloudinary.com/dr6wljwzj/image/upload/v1771552031/laptop_ad_320x50_bcqlzr.jpg' },
            { width: 320, height: 480, title: 'Gen Banner 320x480', url: 'https://res.cloudinary.com/dr6wljwzj/image/upload/v1771551520/laptop_ad_320x480_zd53gy.jpg' },
            { width: 728, height: 90, title: 'Gen Banner 728x90', url: 'https://res.cloudinary.com/dr6wljwzj/image/upload/v1770253999/laptop_display_728_90_t0gzhc.jpg' }
        ];

        for (const banner of banners) {
            await postData('/creatives', {
                campaign_id: campaignId,
                title: banner.title,
                image_url: banner.url,
                landing_url: 'https://storefront.zhibinyang.net/products/laptop/',
                creative_type: 1, // 1 = Banner Image
                width: banner.width,
                height: banner.height,
                status: 1,
                quality_score: 80
            });
            console.log(`   ✅ Created ${banner.width}x${banner.height} Banner`);
        }

        console.log('\n🎉 Successfully generated Advertiser, Campaign, Targeting, and 5 Creatives!');
        console.log(`To verify: curl -s ${API_BASE}/campaigns | jq '.[] | select(.id==${campaignId})'`);

    } catch (error: any) {
        console.error('❌ Error during generation:', error.message);
    }
}

main();
