
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';
import { Status, BidType, CreativeType } from '../src/shared/types';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';

dotenv.config();

async function initDatabase() {
    console.log('Connecting to PostgreSQL...');

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set');
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, { schema });

    console.log('Cleaning up existing data...');
    // Order matters for FK constraints
    await db.execute(sql`TRUNCATE TABLE hourly_stats, ad_events, targeting_rules, creatives, campaigns, advertisers RESTART IDENTITY CASCADE`);

    console.log('Inserting test data...');

    // 1. Advertisers
    const advertisersData = [
        { name: "Game Advertiser", company: "Game Corp A", contact_email: "game@example.com", balance: "50000.00" },
        { name: "E-commerce Advertiser", company: "Shop Corp B", contact_email: "shop@example.com", balance: "100000.00" },
        { name: "Finance Advertiser", company: "Finance Corp C", contact_email: "finance@example.com", balance: "80000.00" },
        { name: "Education Advertiser", company: "Edu Corp D", contact_email: "edu@example.com", balance: "30000.00" },
        { name: "Local Services", company: "Local Corp E", contact_email: "local@example.com", balance: "20000.00" },
    ];

    const insertedAdvertisers = await db.insert(schema.advertisers)
        .values(advertisersData.map(a => ({ ...a, status: Status.ACTIVE })))
        .returning();

    console.log(`  Inserted ${insertedAdvertisers.length} advertisers`);

    // Map for easy ID lookup
    const adv = insertedAdvertisers; // index check: 0=Game, 1=Shop, 2=Finance, 3=Edu, 4=Local

    // 2. Campaigns
    const campaignsData = [
        // Game
        { advertiser_id: adv[0].id, name: "MOBA Game Launch", budget_daily: "1000.00", budget_total: "30000.00", bid_type: BidType.CPC, bid_amount: "2.50" },
        { advertiser_id: adv[0].id, name: "RPG Summer Event", budget_daily: "500.00", budget_total: "15000.00", bid_type: BidType.CPM, bid_amount: "15.00" },
        // E-commerce
        { advertiser_id: adv[1].id, name: "Mid-Year Sale", budget_daily: "5000.00", budget_total: "100000.00", bid_type: BidType.CPC, bid_amount: "1.80" },
        { advertiser_id: adv[1].id, name: "Black Friday Warmup", budget_daily: "3000.00", budget_total: "50000.00", bid_type: BidType.CPC, bid_amount: "2.20" },
        // Finance
        { advertiser_id: adv[2].id, name: "Investment App Promo", budget_daily: "2000.00", budget_total: "60000.00", bid_type: BidType.CPC, bid_amount: "5.00" },
        { advertiser_id: adv[2].id, name: "Gold Card Campaign", budget_daily: "1500.00", budget_total: "45000.00", bid_type: BidType.CPM, bid_amount: "25.00" },
        // Edu
        { advertiser_id: adv[3].id, name: "Online Coding Bootcamps", budget_daily: "800.00", budget_total: "24000.00", bid_type: BidType.CPC, bid_amount: "3.00" },
        // Local
        { advertiser_id: adv[4].id, name: "Food Delivery Promo", budget_daily: "2000.00", budget_total: "40000.00", bid_type: BidType.CPC, bid_amount: "1.50" },
        { advertiser_id: adv[4].id, name: "Ride Sharing Discount", budget_daily: "1000.00", budget_total: "30000.00", bid_type: BidType.CPC, bid_amount: "1.20" },
        // Game New
        { advertiser_id: adv[0].id, name: "New FPS Pre-reg", budget_daily: "300.00", budget_total: "9000.00", bid_type: BidType.CPM, bid_amount: "10.00" },
    ];

    const insertedCampaigns = await db.insert(schema.campaigns)
        .values(campaignsData.map(c => ({
            ...c,
            status: Status.ACTIVE,
            is_active: true,
            start_time: new Date(),
            // End time 30 days later
            end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })))
        .returning();

    console.log(`  Inserted ${insertedCampaigns.length} campaigns`);

    // 3. Creatives
    // Define creatives linked to campaign indices in `campaignsData` array order
    // 0:MOBA, 1:RPG, 2:MidYear, 3:BlackFri, 4:Invest, 5:GoldCard, 6:Coding, 7:Food, 8:Ride, 9:FPS
    const mockCreatives = [
        { cIdx: 0, title: "Play MOBA Legends Now", desc: "Join 5v5 battles with millions of players!", type: CreativeType.BANNER, w: 300, h: 250 },
        { cIdx: 0, title: "MOBA Legends: Epic Highlights", desc: "Watch the best pro plays of the season.", type: CreativeType.VIDEO, w: 640, h: 360 },
        { cIdx: 1, title: "RPG World Expansion", desc: "Explore the new continent and claim free loot!", type: CreativeType.BANNER, w: 300, h: 250 },
        { cIdx: 2, title: "Mid-Year Mega Sale", desc: "Up to 50% off on all electronics!", type: CreativeType.NATIVE, w: 200, h: 200 },
        { cIdx: 2, title: "Top Brands Sale", desc: "Official store discounts, limited time only.", type: CreativeType.BANNER, w: 300, h: 100 },
        { cIdx: 3, title: "Black Friday Early Access", desc: "Double your deposit for the big sale.", type: CreativeType.NATIVE, w: 200, h: 200 },
        { cIdx: 4, title: "Smart Investment App", desc: "Start investing with as little as $10.", type: CreativeType.BANNER, w: 300, h: 250 },
        { cIdx: 5, title: "Apply for Gold Card", desc: "Get 50,000 bonus points upon approval.", type: CreativeType.NATIVE, w: 200, h: 200 },
        { cIdx: 6, title: "Python for Beginners", desc: "Master Python in 30 days. Enroll now!", type: CreativeType.BANNER, w: 300, h: 250 },
        { cIdx: 7, title: "Hungry? Get $20 Off", desc: "First order discount for new users.", type: CreativeType.NATIVE, w: 200, h: 200 },
        { cIdx: 8, title: "Ride for Half Price", desc: "50% off your next 3 rides.", type: CreativeType.BANNER, w: 300, h: 100 },
        { cIdx: 9, title: "Pre-register for Shooter X", desc: "Get exclusive weapon skins at launch.", type: CreativeType.BANNER, w: 300, h: 250 },
    ];

    await db.insert(schema.creatives).values(mockCreatives.map(c => ({
        campaign_id: insertedCampaigns[c.cIdx].id,
        title: c.title,
        description: c.desc,
        creative_type: c.type,
        width: c.w,
        height: c.h,
        landing_url: `https://example.com/landing/${insertedCampaigns[c.cIdx].id}`,
        image_url: `https://via.placeholder.com/${c.w}x${c.h}`,
        status: Status.ACTIVE,
    })));

    console.log(`  Inserted ${mockCreatives.length} creatives`);

    // 4. Targeting Rules
    const rulesData = [
        { cIdx: 0, type: 'device', value: { os: ["android", "ios"] } },
        { cIdx: 0, type: 'geo', value: { countries: ["US", "CA", "UK"] } }, // Changed to Western geo
        { cIdx: 1, type: 'age', value: { min: 18, max: 34 } },
        { cIdx: 2, type: 'device', value: { os: ["android"] } },
        { cIdx: 2, type: 'geo', value: { countries: ["US"] } },
        { cIdx: 4, type: 'age', value: { min: 25, max: 99 } },
        { cIdx: 6, type: 'interest', value: { values: ["programming", "technology"] } },
        { cIdx: 7, type: 'geo', value: { countries: ["US", "NY"] } }, // Example US targeting
    ];

    await db.insert(schema.targeting_rules).values(rulesData.map(r => ({
        campaign_id: insertedCampaigns[r.cIdx].id,
        rule_type: r.type,
        rule_value: r.value,
        is_include: true,
    })));

    console.log(`  Inserted ${rulesData.length} targeting rules`);

    await pool.end();
    console.log('Database initialization complete!');
}

initDatabase().catch(console.error);
