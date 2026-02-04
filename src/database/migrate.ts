import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigrations() {
    console.log('Running migrations...');

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set');
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool);

    try {
        // This will run migrations from the 'drizzle' folder
        await migrate(db, { migrationsFolder: './drizzle' });
        console.log('Migrations completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigrations();
