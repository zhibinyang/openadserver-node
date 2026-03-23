import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';
import { Status, BidType, CreativeType, PacingType } from '../src/shared/types';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const COLLECTION_NAME = 'geo_vectors';
const VECTOR_DIM = 3072;

// Real creative URLs from generate_config.ts
const BANNER_URLS = {
    '300x250': 'https://res.cloudinary.com/dr6wljwzj/image/upload/v1771551520/laptop_ad_300x250_pwydnm.jpg',
    '300x600': 'https://res.cloudinary.com/dr6wljwzj/image/upload/v1771551520/laptop_ad_300x600_vikk2w.jpg',
    '320x50': 'https://res.cloudinary.com/dr6wljwzj/image/upload/v1771552031/laptop_ad_320x50_bcqlzr.jpg',
    '320x480': 'https://res.cloudinary.com/dr6wljwzj/image/upload/v1771551520/laptop_ad_320x480_zd53gy.jpg',
    '728x90': 'https://res.cloudinary.com/dr6wljwzj/image/upload/v1770253999/laptop_display_728_90_t0gzhc.jpg',
};

const VIDEO_URL = 'https://res.cloudinary.com/dr6wljwzj/video/upload/v1770622948/laptop_video_ad_lf3cwd.mp4';

// --- Helper functions for optional GEO knowledge seeding ---

async function checkMilvusConnection(): Promise<MilvusClient | null> {
    const host = process.env.MILVUS_HOST || 'localhost';
    const port = process.env.MILVUS_PORT || '19530';

    try {
        const client = new MilvusClient({ address: `${host}:${port}` });
        // Test connection
        await client.hasCollection({ collection_name: COLLECTION_NAME });
        console.log(`  Milvus connected at ${host}:${port}`);
        return client;
    } catch (error) {
        console.log(`  Milvus not available: ${error}`);
        return null;
    }
}

async function checkLLMAPI(): Promise<GoogleGenAI | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log('  GEMINI_API_KEY not configured');
        return null;
    }
    try {
        const ai = new GoogleGenAI({ apiKey });
        console.log('  Gemini API configured');
        return ai;
    } catch (error) {
        console.log(`  Gemini API error: ${error}`);
        return null;
    }
}

async function ensureMilvusCollection(client: MilvusClient): Promise<void> {
    const hasCollection = await client.hasCollection({ collection_name: COLLECTION_NAME });

    if (!hasCollection.value) {
        console.log(`  Creating Milvus collection: ${COLLECTION_NAME}`);
        await client.createCollection({
            collection_name: COLLECTION_NAME,
            fields: [
                { name: 'pk', data_type: DataType.Int64, is_primary_key: true, autoID: true },
                { name: 'knowledge_id', data_type: DataType.Int64 },
                { name: 'creative_id', data_type: DataType.Int64 },
                { name: 'campaign_id', data_type: DataType.Int64 },
                { name: 'vector', data_type: DataType.FloatVector, dim: VECTOR_DIM },
                { name: 'updated_at', data_type: DataType.Int64 },
            ],
        });

        await client.createIndex({
            collection_name: COLLECTION_NAME,
            field_name: 'vector',
            index_type: 'IVF_FLAT',
            metric_type: 'COSINE',
            params: { nlist: 128 },
        });
    }

    await client.loadCollection({ collection_name: COLLECTION_NAME });
}

async function generateEmbedding(ai: GoogleGenAI, text: string): Promise<number[]> {
    const model = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
    const result = await ai.models.embedContent({
        model,
        contents: text,
    });

    const vector = result.embeddings?.[0]?.values;
    if (!vector || vector.length === 0) {
        throw new Error('Embedding API returned empty vector');
    }
    return vector;
}

async function seedGeoKnowledge(
    db: any,
    milvusClient: MilvusClient,
    ai: GoogleGenAI,
    advertisers: any[],
    campaigns: any[],
    creatives: any[],
): Promise<void> {
    console.log('Seeding GEO knowledge...');

    await ensureMilvusCollection(milvusClient);

    // Knowledge data linked to existing advertisers/campaigns/creatives
    // Creative indices: 0:MOBA-Banner, 1:MOBA-Video, 2:RPG-Banner, 3:RPG-Inter, 4:MidYear-Native,
    //                   5:MidYear-Banner, 6:BlackFri-Inter, 7:BlackFri-Native, 8:Invest-Banner,
    //                   9:Invest-Video, 10:GoldCard-Native, 11:GoldCard-Banner, 12:Coding-Banner,
    //                   13:Coding-Native, 14:Food-Inter, 15:Food-Native, 16:Ride-Banner, 17:Ride-Native,
    //                   18:FPS-Banner, 19:FPS-Video
    const knowledgeData = [
        // Game advertiser (idx 0) - MOBA campaign (idx 0)
        {
            advIdx: 0, campIdx: 0, creIdx: 0,
            title: "MOBA Legends - Best Free Strategy Game",
            content: "Join millions of players in the ultimate 5v5 battle arena. MOBA Legends offers intense real-time strategy gameplay with over 100 unique heroes to choose from. Free to play with fair monetization. Download now and get 500 free gems!",
            source_url: "https://example.com/moba-legends"
        },
        // Game advertiser (idx 0) - RPG campaign (idx 1)
        {
            advIdx: 0, campIdx: 1, creIdx: 2,
            title: "RPG World Summer Expansion Event",
            content: "Explore the new Dragonfire Continent in our biggest expansion ever! New quests, dungeons, and legendary loot await. Summer event runs through August with double XP weekends and exclusive cosmetic rewards.",
            source_url: "https://example.com/rpg-world"
        },
        // E-commerce advertiser (idx 1) - Mid-Year Sale (idx 2)
        {
            advIdx: 1, campIdx: 2, creIdx: 4,
            title: "Mid-Year Mega Sale - Up to 70% Off",
            content: "The biggest mid-year sale is here! Save up to 70% on electronics, fashion, home goods, and more. Free shipping on orders over $50. Limited time offers on top brands including Apple, Samsung, and Sony.",
            source_url: "https://example.com/mid-year-sale"
        },
        // Finance advertiser (idx 2) - Investment App (idx 4)
        {
            advIdx: 2, campIdx: 4, creIdx: 8,
            title: "Smart Investing for Beginners",
            content: "Start your investment journey with as little as $10. Our AI-powered platform helps you build a diversified portfolio tailored to your goals. No hidden fees, real-time market data, and educational resources for new investors.",
            source_url: "https://example.com/smart-invest"
        },
        // Education advertiser (idx 3) - Coding Bootcamp (idx 6)
        {
            advIdx: 3, campIdx: 6, creIdx: 12,
            title: "Learn Python Programming in 30 Days",
            content: "Master Python from scratch with our intensive 30-day bootcamp. Build real projects, get 1-on-1 mentorship, and join a community of 50,000+ developers. Job placement assistance included. No prior coding experience required.",
            source_url: "https://example.com/python-bootcamp"
        },
        // Local Services (idx 4) - Food Delivery (idx 7)
        {
            advIdx: 4, campIdx: 7, creIdx: 14,
            title: "Food Delivery - $20 Off Your First Order",
            content: "Craving your favorite restaurant? Get $20 off your first order with our food delivery app. 30-minute delivery guarantee, real-time order tracking, and thousands of restaurants to choose from. Available in all major cities.",
            source_url: "https://example.com/food-delivery"
        },
    ];

    const insertedKnowledge: any[] = [];

    for (const k of knowledgeData) {
        // Insert into Postgres
        const [knowledge] = await db.insert(schema.geo_knowledge)
            .values({
                advertiser_id: advertisers[k.advIdx].id,
                campaign_id: campaigns[k.campIdx].id,
                creative_id: creatives[k.creIdx].id,
                title: k.title,
                content: k.content,
                source_url: k.source_url,
                embedding_status: 'pending',
                status: Status.ACTIVE,
            })
            .returning();

        insertedKnowledge.push({
            ...knowledge,
            campaign_id: campaigns[k.campIdx].id,
            creative_id: creatives[k.creIdx].id,
        });

        console.log(`  Inserted knowledge: ${k.title}`);
    }

    // Generate embeddings and insert into Milvus
    console.log('Generating embeddings and inserting into Milvus...');

    for (const knowledge of insertedKnowledge) {
        try {
            // Combine title and content for embedding
            const text = `${knowledge.title}\n\n${knowledge.content}`;
            const vector = await generateEmbedding(ai, text);

            // Insert into Milvus
            await milvusClient.insert({
                collection_name: COLLECTION_NAME,
                data: [{
                    knowledge_id: knowledge.id,
                    creative_id: knowledge.creative_id,
                    campaign_id: knowledge.campaign_id,
                    vector,
                    updated_at: Date.now(),
                }],
            });

            // Update embedding status
            await db.update(schema.geo_knowledge)
                .set({ embedding_status: 'completed' })
                .where(sql`${schema.geo_knowledge.id} = ${knowledge.id}`);

            console.log(`  Embedded and indexed: ${knowledge.title}`);
        } catch (error) {
            console.error(`  Failed to embed knowledge ${knowledge.id}: ${error}`);
            await db.update(schema.geo_knowledge)
                .set({ embedding_status: 'failed' })
                .where(sql`${schema.geo_knowledge.id} = ${knowledge.id}`);
        }
    }

    console.log(`  Completed ${insertedKnowledge.length} GEO knowledge entries`);
}

async function seedInterests(db: any) {
    console.log('Seeding audience interests...');

    const initialInterests = [
        { code: 'tech', name: 'Technology & Gadgets', description: 'Interested in software, hardware, and tech news.' },
        { code: 'news', name: 'News & Politics', description: 'Follows current events and global news.' },
        { code: 'sports', name: 'Sports & Fitness', description: 'Interested in sports teams, fitness, and health.' },
        { code: 'finance', name: 'Finance & Business', description: 'Financial markets, investing, and business management.' },
        { code: 'fashion', name: 'Fashion & Beauty', description: 'Clothing trends, cosmetics, and style.' },
        { code: 'travel', name: 'Travel & Tourism', description: 'Vacations, flights, and exploring destinations.' },
        { code: 'gaming', name: 'Gaming', description: 'Video games, esports, and gaming channels.' },
        { code: 'music', name: 'Music & Audio', description: 'Streaming services, concerts, and bands.' },
        { code: 'shopping', name: 'Shopping & E-commerce', description: 'Online shopping, deals, and product reviews.' },
        { code: 'automotive', name: 'Automotive', description: 'Cars, vehicles, and racing.' },
    ];

    for (const interest of initialInterests) {
        await db.insert(schema.audience_interests)
            .values(interest)
            .onConflictDoUpdate({
                target: schema.audience_interests.code,
                set: {
                    name: interest.name,
                    description: interest.description,
                    updated_at: new Date(),
                }
            });
    }
    console.log(`  Upserted ${initialInterests.length} audience interests`);
}

async function initDatabase() {
    console.log('Connecting to PostgreSQL...');

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set');
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, { schema });

    console.log('Cleaning up existing data...');
    // Order matters for FK constraints
    await db.execute(sql`TRUNCATE TABLE
        hourly_stats, ad_events, targeting_rules, creative_renditions, creatives,
        ad_groups, campaigns, advertisers, audience_interests, geo_knowledge,
        slots, apps, app_categories
        RESTART IDENTITY CASCADE`);

    // Seed audience interests first (reference data)
    await seedInterests(db);

    console.log('Inserting test data...');

    // 1. Advertisers
    const advertisersData = [
        { name: "Game Advertiser", company: "Game Corp A", contact_email: "game@example.com", balance: "50000.00", daily_budget: "5000.00", brand_weight: "1.2" },
        { name: "E-commerce Advertiser", company: "Shop Corp B", contact_email: "shop@example.com", balance: "100000.00", daily_budget: "10000.00", brand_weight: "1.5" },
        { name: "Finance Advertiser", company: "Finance Corp C", contact_email: "finance@example.com", balance: "80000.00", daily_budget: "8000.00", brand_weight: "1.3" },
        { name: "Education Advertiser", company: "Edu Corp D", contact_email: "edu@example.com", balance: "30000.00", daily_budget: "3000.00", brand_weight: "1.0" },
        { name: "Local Services", company: "Local Corp E", contact_email: "local@example.com", balance: "20000.00", daily_budget: "2000.00", brand_weight: "1.1" },
    ];

    const insertedAdvertisers = await db.insert(schema.advertisers)
        .values(advertisersData.map(a => ({ ...a, status: Status.ACTIVE })))
        .returning();

    console.log(`  Inserted ${insertedAdvertisers.length} advertisers`);

    // Map for easy ID lookup
    const adv = insertedAdvertisers; // index check: 0=Game, 1=Shop, 2=Finance, 3=Edu, 4=Local

    // 2. Campaigns - covering all BidTypes and PacingTypes
    const campaignsData = [
        // Game - CPC, EVEN pacing
        {
            advertiser_id: adv[0].id,
            name: "MOBA Game Launch",
            description: "Launch campaign for new MOBA game targeting mobile gamers",
            budget_daily: "1000.00",
            budget_total: "30000.00",
            bid_type: BidType.CPC,
            bid_amount: "2.50",
            pacing_type: PacingType.EVEN,
            freq_cap_daily: 8,
            freq_cap_hourly: 2,
        },
        // Game - CPM, AGGRESSIVE pacing
        {
            advertiser_id: adv[0].id,
            name: "RPG Summer Event",
            description: "Summer expansion event promotion for RPG World",
            budget_daily: "500.00",
            budget_total: "15000.00",
            bid_type: BidType.CPM,
            bid_amount: "15.00",
            pacing_type: PacingType.AGGRESSIVE,
            freq_cap_daily: 10,
            freq_cap_hourly: 3,
        },
        // E-commerce - CPC, DAILY_ASAP pacing
        {
            advertiser_id: adv[1].id,
            name: "Mid-Year Sale",
            description: "Mid-year mega sale with up to 70% off electronics and fashion",
            budget_daily: "5000.00",
            budget_total: "100000.00",
            bid_type: BidType.CPC,
            bid_amount: "1.80",
            pacing_type: PacingType.DAILY_ASAP,
            freq_cap_daily: 6,
            freq_cap_hourly: 2,
        },
        // E-commerce - OCPM, FLIGHT_ASAP pacing
        {
            advertiser_id: adv[1].id,
            name: "Black Friday Warmup",
            description: "Pre-Black Friday awareness campaign with early access deals",
            budget_daily: "3000.00",
            budget_total: "50000.00",
            bid_type: BidType.OCPM,
            bid_amount: "2.20",
            pacing_type: PacingType.FLIGHT_ASAP,
            freq_cap_daily: 12,
            freq_cap_hourly: 4,
        },
        // Finance - CPC, EVEN pacing
        {
            advertiser_id: adv[2].id,
            name: "Investment App Promo",
            description: "Smart investing app for beginners with AI-powered portfolio management",
            budget_daily: "2000.00",
            budget_total: "60000.00",
            bid_type: BidType.CPC,
            bid_amount: "5.00",
            pacing_type: PacingType.EVEN,
            freq_cap_daily: 5,
            freq_cap_hourly: 1,
        },
        // Finance - CPM, AGGRESSIVE pacing
        {
            advertiser_id: adv[2].id,
            name: "Gold Card Campaign",
            description: "Premium credit card with travel rewards and cashback",
            budget_daily: "1500.00",
            budget_total: "45000.00",
            bid_type: BidType.CPM,
            bid_amount: "25.00",
            pacing_type: PacingType.AGGRESSIVE,
            freq_cap_daily: 8,
            freq_cap_hourly: 2,
        },
        // Edu - CPA, EVEN pacing
        {
            advertiser_id: adv[3].id,
            name: "Online Coding Bootcamps",
            description: "30-day Python programming bootcamp with job placement assistance",
            budget_daily: "800.00",
            budget_total: "24000.00",
            bid_type: BidType.CPA,
            bid_amount: "50.00",
            pacing_type: PacingType.EVEN,
            freq_cap_daily: 4,
            freq_cap_hourly: 1,
        },
        // Local - CPC, DAILY_ASAP pacing
        {
            advertiser_id: adv[4].id,
            name: "Food Delivery Promo",
            description: "Food delivery app with $20 off first order for new users",
            budget_daily: "2000.00",
            budget_total: "40000.00",
            bid_type: BidType.CPC,
            bid_amount: "1.50",
            pacing_type: PacingType.DAILY_ASAP,
            freq_cap_daily: 15,
            freq_cap_hourly: 5,
        },
        // Local - CPC, EVER_GREEN pacing (fallback)
        {
            advertiser_id: adv[4].id,
            name: "Ride Sharing Discount",
            description: "50% off your next 3 rides with ride-sharing app",
            budget_daily: "1000.00",
            budget_total: "30000.00",
            bid_type: BidType.CPC,
            bid_amount: "1.20",
            pacing_type: PacingType.EVER_GREEN,
            freq_cap_daily: 20,
            freq_cap_hourly: 6,
        },
        // Game - CPM, FLIGHT_ASAP pacing
        {
            advertiser_id: adv[0].id,
            name: "New FPS Pre-reg",
            description: "Pre-registration campaign for upcoming FPS game with exclusive skins",
            budget_daily: "300.00",
            budget_total: "9000.00",
            bid_type: BidType.CPM,
            bid_amount: "10.00",
            pacing_type: PacingType.FLIGHT_ASAP,
            freq_cap_daily: 6,
            freq_cap_hourly: 2,
        },
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

    // 2.5 Ad Groups - one per campaign (new architecture)
    console.log('\nInserting ad groups...');
    const adGroupsData = insertedCampaigns.map((campaign, idx) => ({
        campaign_id: campaign.id,
        name: `${campaign.name} - Ad Group`,
        marketing_goal: idx % 5 === 0 ? 1 : idx % 5 === 1 ? 2 : idx % 5 === 2 ? 3 : idx %5 ===3 ? 4 :5, // Cycle through all marketing goals
        bid_amount: campaign.bid_amount, // Migrate bid from campaign to ad group
        freq_cap_daily: campaign.freq_cap_daily,
        freq_cap_hourly: campaign.freq_cap_hourly,
        status: Status.ACTIVE,
    }));

    const insertedAdGroups = await db.insert(schema.ad_groups)
        .values(adGroupsData)
        .returning();

    console.log(`  Inserted ${insertedAdGroups.length} ad groups`);

    // 3. Supply Side test data: IAB Categories, Apps, Slots (insert before creatives for foreign key)
    console.log('\nInserting supply side test data...');

    // Insert IAB Categories
    const iabCategories = [
        { code: 'IAB1', name: 'Arts & Entertainment', description: 'Movies, music, games, books' },
        { code: 'IAB2', name: 'Automotive', description: 'Cars, trucks, motorcycles, auto parts' },
        { code: 'IAB3', name: 'Business', description: 'Finance, marketing, human resources' },
        { code: 'IAB4', name: 'Education', description: 'Colleges, online courses, textbooks' },
        { code: 'IAB5', name: 'Health & Fitness', description: 'Diet, exercise, medical advice' },
        { code: 'IAB6', name: 'Technology & Computing', description: 'Software, hardware, consumer electronics' },
    ];
    await db.insert(schema.app_categories).values(iabCategories.map(cat => ({
        ...cat,
        status: Status.ACTIVE,
    })));
    console.log(`  Inserted ${iabCategories.length} IAB categories`);

    // Insert Test Apps
    const appsData = [
        { bundle_id: 'com.game.moba', name: 'MOBA Legends', category_id: 1 }, // Entertainment
        { bundle_id: 'com.shop.ecommerce', name: 'Super Shop', category_id: 3 }, // Business
        { bundle_id: 'com.social.media', name: 'Social Connect', category_id: 1 }, // Entertainment
        { bundle_id: 'com.news.daily', name: 'Daily News', category_id: 6 }, // Technology
        { bundle_id: 'com.fitness.app', name: 'Fit Pro', category_id: 5 }, // Health
    ];
    const insertedApps = await db.insert(schema.apps).values(appsData.map(app => ({
        ...app,
        status: Status.ACTIVE,
    }))).returning();
    console.log(`  Inserted ${insertedApps.length} test apps`);

    // Insert Test Slots
    const slotsData = [];
    for (const app of insertedApps) {
        // Add multiple slots per app
        slotsData.push(
            { app_id: app.id, slot_type: 1, width: 320, height: 50, description: 'Banner 320x50' },
            { app_id: app.id, slot_type: 1, width: 300, height: 250, description: 'Banner 300x250' },
            { app_id: app.id, slot_type: 2, width: 300, height: 250, description: 'Native Ad' },
            { app_id: app.id, slot_type: 3, width: 1280, height: 720, description: 'Video Ad' },
            { app_id: app.id, slot_type: 4, width: 320, height: 480, description: 'Interstitial Ad' },
        );
    }
    await db.insert(schema.slots).values(slotsData.map(slot => ({
        ...slot,
        status: Status.ACTIVE,
    })));
    console.log(`  Inserted ${slotsData.length} ad slots`);

    // 4. Creatives - covering all CreativeTypes (BANNER=1, NATIVE=2, VIDEO=3, INTERSTITIAL=4)
    // Campaign indices: 0:MOBA, 1:RPG, 2:MidYear, 3:BlackFri, 4:Invest, 5:GoldCard, 6:Coding, 7:Food, 8:Ride, 9:FPS
    const mockCreatives = [
        // MOBA Campaign (idx 0) - BANNER + VIDEO
        {
            cIdx: 0, title: "Play MOBA Legends Now", desc: "Join 5v5 battles with millions of players! Free to play with 100+ heroes.",
            type: CreativeType.BANNER, w: 300, h: 250, quality_score: 85,
            image_url: BANNER_URLS['300x250'],
        },
        {
            cIdx: 0, title: "MOBA Legends: Epic Highlights", desc: "Watch the best pro plays of the season. Intense 5v5 action!",
            type: CreativeType.VIDEO, w: 1280, h: 720, quality_score: 90, duration: 8,
            video_url: VIDEO_URL,
        },
        // RPG Campaign (idx 1) - BANNER + INTERSTITIAL
        {
            cIdx: 1, title: "RPG World Expansion", desc: "Explore the new Dragonfire Continent and claim legendary loot!",
            type: CreativeType.BANNER, w: 300, h: 250, quality_score: 82,
            image_url: BANNER_URLS['300x250'],
        },
        {
            cIdx: 1, title: "RPG World: Full Screen Adventure", desc: "Immerse yourself in the epic summer expansion!",
            type: CreativeType.INTERSTITIAL, w: 320, h: 480, quality_score: 88,
            image_url: BANNER_URLS['320x480'],
        },
        // Mid-Year Sale (idx 2) - BANNER + NATIVE
        {
            cIdx: 2, title: "Mid-Year Mega Sale", desc: "Up to 70% off on all electronics! Free shipping over $50.",
            type: CreativeType.NATIVE, w: 200, h: 200, quality_score: 78,
            image_url: BANNER_URLS['300x250'],
        },
        {
            cIdx: 2, title: "Top Brands Sale", desc: "Official store discounts on Apple, Samsung, Sony. Limited time!",
            type: CreativeType.BANNER, w: 728, h: 90, quality_score: 80,
            image_url: BANNER_URLS['728x90'],
        },
        // Black Friday (idx 3) - INTERSTITIAL + NATIVE
        {
            cIdx: 3, title: "Black Friday Early Access", desc: "Double your deposit for the big sale. Exclusive member preview!",
            type: CreativeType.INTERSTITIAL, w: 320, h: 480, quality_score: 92,
            image_url: BANNER_URLS['320x480'],
        },
        {
            cIdx: 3, title: "Black Friday Deals", desc: "Be first to access the biggest sale of the year.",
            type: CreativeType.NATIVE, w: 300, h: 250, quality_score: 75,
            image_url: BANNER_URLS['300x250'],
        },
        // Investment App (idx 4) - BANNER + VIDEO
        {
            cIdx: 4, title: "Smart Investment App", desc: "Start investing with as little as $10. AI-powered portfolio management.",
            type: CreativeType.BANNER, w: 300, h: 250, quality_score: 85,
            image_url: BANNER_URLS['300x250'],
        },
        {
            cIdx: 4, title: "Investment App Demo", desc: "See how our AI builds your perfect portfolio in 60 seconds.",
            type: CreativeType.VIDEO, w: 1280, h: 720, quality_score: 88, duration: 8,
            video_url: VIDEO_URL,
        },
        // Gold Card (idx 5) - NATIVE + BANNER
        {
            cIdx: 5, title: "Apply for Gold Card", desc: "Get 50,000 bonus points upon approval. Travel rewards & cashback.",
            type: CreativeType.NATIVE, w: 200, h: 200, quality_score: 82,
            image_url: BANNER_URLS['300x250'],
        },
        {
            cIdx: 5, title: "Gold Card Premium", desc: "Premium credit card for discerning customers. No annual fee first year.",
            type: CreativeType.BANNER, w: 300, h: 600, quality_score: 86,
            image_url: BANNER_URLS['300x600'],
        },
        // Coding Bootcamp (idx 6) - BANNER + NATIVE
        {
            cIdx: 6, title: "Python for Beginners", desc: "Master Python in 30 days. 1-on-1 mentorship, job placement assistance.",
            type: CreativeType.BANNER, w: 300, h: 250, quality_score: 80,
            image_url: BANNER_URLS['300x250'],
        },
        {
            cIdx: 6, title: "Learn to Code", desc: "Join 50,000+ developers. No prior experience required.",
            type: CreativeType.NATIVE, w: 320, h: 50, quality_score: 76,
            image_url: BANNER_URLS['320x50'],
        },
        // Food Delivery (idx 7) - INTERSTITIAL + NATIVE
        {
            cIdx: 7, title: "Hungry? Get $20 Off", desc: "First order discount for new users. 30-minute delivery guarantee.",
            type: CreativeType.INTERSTITIAL, w: 320, h: 480, quality_score: 90,
            image_url: BANNER_URLS['320x480'],
        },
        {
            cIdx: 7, title: "Food Delivery App", desc: "Thousands of restaurants. Real-time tracking. Order now!",
            type: CreativeType.NATIVE, w: 300, h: 250, quality_score: 78,
            image_url: BANNER_URLS['300x250'],
        },
        // Ride Sharing (idx 8) - BANNER + NATIVE (EVER_GREEN fallback)
        {
            cIdx: 8, title: "Ride for Half Price", desc: "50% off your next 3 rides. Available in all major cities.",
            type: CreativeType.BANNER, w: 320, h: 50, quality_score: 84,
            image_url: BANNER_URLS['320x50'],
        },
        {
            cIdx: 8, title: "Ride Sharing App", desc: "Safe, affordable rides in minutes. Download now.",
            type: CreativeType.NATIVE, w: 300, h: 250, quality_score: 72,
            image_url: BANNER_URLS['300x250'],
        },
        // FPS Pre-reg (idx 9) - VIDEO + BANNER
        {
            cIdx: 9, title: "Pre-register for Shooter X", desc: "Get exclusive weapon skins at launch. Coming this fall!",
            type: CreativeType.BANNER, w: 300, h: 250, quality_score: 88,
            image_url: BANNER_URLS['300x250'],
        },
        {
            cIdx: 9, title: "Shooter X Gameplay Trailer", desc: "Watch the action-packed trailer. Pre-register for bonus rewards!",
            type: CreativeType.VIDEO, w: 1280, h: 720, quality_score: 92, duration: 8,
            video_url: VIDEO_URL,
        },
    ];

    const insertedCreatives = await db.insert(schema.creatives).values(mockCreatives.map(c => ({
        campaign_id: insertedCampaigns[c.cIdx].id,
        ad_group_id: insertedAdGroups[c.cIdx].id, // Associate with corresponding ad group
        ad_category_id: (c.cIdx % 6) + 1, // Assign IAB category 1-6
        title: c.title,
        description: c.desc,
        creative_type: c.type,
        width: c.w,
        height: c.h,
        duration: c.duration || null,
        video_url: c.video_url || null,
        image_url: c.image_url || `https://via.placeholder.com/${c.w}x${c.h}`,
        landing_url: `https://example.com/landing/${insertedCampaigns[c.cIdx].id}`,
        status: Status.ACTIVE,
        quality_score: c.quality_score,
        freq_cap_daily: 10,
        freq_cap_hourly: 3,
    }))).returning();

    console.log(`  Inserted ${mockCreatives.length} creatives`);

    // 5. Insert Creative Renditions (multi-size variants for each creative)
    console.log('\nInserting creative renditions...');
    const renditionsData = [];
    for (const creative of insertedCreatives) {
        // Add multiple renditions per creative
        if (creative.creative_type === 1) { // Banner
            renditionsData.push(
                { creative_id: creative.id, slot_type: 1, width: 320, height: 50, file_url: BANNER_URLS['320x50'] },
                { creative_id: creative.id, slot_type: 1, width: 300, height: 250, file_url: BANNER_URLS['300x250'] },
                { creative_id: creative.id, slot_type: 1, width: 728, height: 90, file_url: BANNER_URLS['728x90'] },
                { creative_id: creative.id, slot_type: 1, width: 300, height: 600, file_url: BANNER_URLS['300x600'] },
            );
        } else if (creative.creative_type === 3) { // Video
            renditionsData.push(
                { creative_id: creative.id, slot_type: 3, width: 1280, height: 720, file_url: VIDEO_URL, duration: creative.duration },
                { creative_id: creative.id, slot_type: 3, width: 640, height: 360, file_url: VIDEO_URL, duration: creative.duration },
            );
        } else if (creative.creative_type === 4) { // Interstitial
            renditionsData.push(
                { creative_id: creative.id, slot_type: 4, width: 320, height: 480, file_url: BANNER_URLS['320x480'] },
                { creative_id: creative.id, slot_type: 4, width: 480, height: 320, file_url: BANNER_URLS['320x480'] },
            );
        } else { // Native
            renditionsData.push(
                { creative_id: creative.id, slot_type: 2, width: 300, height: 250, file_url: BANNER_URLS['300x250'] },
                { creative_id: creative.id, slot_type: 2, width: 200, height: 200, file_url: BANNER_URLS['300x250'] },
                { creative_id: creative.id, slot_type: 2, width: 320, height: 50, file_url: BANNER_URLS['320x50'] },
            );
        }
    }
    await db.insert(schema.creative_renditions).values(renditionsData.map(r => ({
        ...r,
        status: Status.ACTIVE,
    })));
    console.log(`  Inserted ${renditionsData.length} creative renditions`);

    // 6. Targeting Rules
    const rulesData = [
        { cIdx: 0, type: 'device', value: { os: ["android", "ios"] } },
        { cIdx: 0, type: 'geo', value: { countries: ["US", "CA", "UK"] } },
        { cIdx: 1, type: 'age', value: { min: 18, max: 34 } },
        { cIdx: 2, type: 'device', value: { os: ["android"] } },
        { cIdx: 2, type: 'geo', value: { countries: ["US"] } },
        { cIdx: 4, type: 'age', value: { min: 25, max: 99 } },
        { cIdx: 6, type: 'interest', value: { values: ["programming", "technology"] } },
        { cIdx: 7, type: 'geo', value: { countries: ["US", "NY"] } },
    ];

    await db.insert(schema.targeting_rules).values(rulesData.map(r => ({
        ad_group_id: insertedAdGroups[r.cIdx].id, // Bind rules to ad group instead of campaign
        rule_type: r.type,
        rule_value: r.value,
        is_include: true,
    })));

    console.log(`  Inserted ${rulesData.length} targeting rules`);

    // 5. Optional: GEO Knowledge seeding (requires Milvus + LLM API)
    console.log('\nChecking GEO knowledge prerequisites...');
    const milvusClient = await checkMilvusConnection();
    const ai = await checkLLMAPI();

    if (milvusClient && ai) {
        console.log('Prerequisites met, seeding GEO knowledge...');
        await seedGeoKnowledge(db, milvusClient, ai, insertedAdvertisers, insertedCampaigns, insertedCreatives);
    } else {
        console.log('Skipping GEO knowledge seeding (Milvus or LLM API not available)');
    }

    await pool.end();
    console.log('\nDatabase initialization complete!');
}

initDatabase().catch(console.error);
