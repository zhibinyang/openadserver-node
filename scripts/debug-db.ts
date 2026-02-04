
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';
import { eq, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function check() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, { schema });

    console.log('Checking DB state...');

    // 1. Check Campaigns
    const campaigns = await db.query.campaigns.findMany();
    console.log(`Total Campaigns: ${campaigns.length}`);

    const campaignsActive = await db.query.campaigns.findMany({
        where: and(
            eq(schema.campaigns.status, 1),
            eq(schema.campaigns.is_active, true)
        ),
    });
    console.log(`Active Campaigns: ${campaignsActive.length}`);
    console.log('Active Campaign IDs:', campaignsActive.map(c => c.id));

    // 2. Check Creatives
    const creatives = await db.query.creatives.findMany();
    console.log(`\nTotal Creatives: ${creatives.length}`);
    if (creatives.length > 0) {
        console.log('Sample Creative:', creatives[0]);
    }

    const creativesActive = await db.query.creatives.findMany({
        where: eq(schema.creatives.status, 1),
    });
    console.log(`Active Creatives: ${creativesActive.length}`);

    if (creativesActive.length > 0) {
        console.log('Sample Active Creative:', creativesActive[0]);

        // Check link
        const validLink = creativesActive.filter(c => campaignsActive.some(cmp => cmp.id === c.campaign_id));
        console.log(`Active Creatives linked to Active Campaigns: ${validLink.length}`);
    } else {
        console.log('No active creatives found! Check if "status" column is 1.');
    }

    process.exit(0);
}

check().catch(console.error);
