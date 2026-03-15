
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config();

async function seedAdminUser() {
    console.log('Connecting to PostgreSQL...');

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set');
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, { schema });

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // Check if admin user already exists
    const existingUsers = await db.select()
        .from(schema.users)
        .where(schema.users.username.eq ? schema.users.username : null as any);

    // Use raw query to check
    const result = await pool.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [adminUsername, adminEmail]
    );

    if (result.rows.length > 0) {
        console.log('Admin user already exists');
        await pool.end();
        return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    await db.insert(schema.users).values({
        username: adminUsername,
        email: adminEmail,
        password_hash: passwordHash,
        role: 'admin',
        status: 1,
    });

    console.log(`Admin user created successfully!`);
    console.log(`  Username: ${adminUsername}`);
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log(`  Please change the password after first login.`);

    await pool.end();
}

seedAdminUser().catch(console.error);
