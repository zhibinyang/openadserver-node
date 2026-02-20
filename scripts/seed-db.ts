import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import * as schema from '../src/database/schema';

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
        console.log(`Upserted interest: ${interest.code}`);
    }
}

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    const db = drizzle(client, { schema });

    console.log('--- Starting Database Seeding ---');

    // Add necessary seed functions here
    await seedInterests(db);

    // await seedOtherThings(db);

    console.log('--- Seeding Completed ---');
    await client.end();
}

main().catch((err) => {
    console.error('Error seeding database:', err);
    process.exit(1);
});
