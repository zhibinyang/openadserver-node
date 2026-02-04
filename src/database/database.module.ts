
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE_CONNECTION';

@Global()
@Module({
    providers: [
        {
            provide: DRIZZLE,
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => {
                const connectionString = configService.get<string>('DATABASE_URL');
                if (!connectionString) {
                    throw new Error('DATABASE_URL is not defined in environment variables');
                }

                const pool = new Pool({
                    connectionString,
                });

                return drizzle(pool, { schema });
            },
        },
    ],
    exports: [DRIZZLE],
})
export class DatabaseModule { }
