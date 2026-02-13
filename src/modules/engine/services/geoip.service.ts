import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as maxmind from 'maxmind';
import * as path from 'path';
import * as fs from 'fs';

export interface GeoResult {
    country: string | null;
    city: string | null;
}

@Injectable()
export class GeoIpService implements OnModuleInit {
    private readonly logger = new Logger(GeoIpService.name);
    private lookup: maxmind.Reader<maxmind.CityResponse> | null = null;

    async onModuleInit() {
        const dbPath = process.env.GEO_DB_PATH || path.join(process.cwd(), 'libs', 'geo', 'GeoLite2-City.mmdb');

        if (!fs.existsSync(dbPath)) {
            this.logger.warn(`GeoIP database not found at ${dbPath}. Geo resolution will be disabled.`);
            return;
        }

        try {
            this.lookup = await maxmind.open<maxmind.CityResponse>(dbPath);
            this.logger.log(`Loaded GeoIP City database from ${dbPath}`);
        } catch (e) {
            this.logger.error(`Failed to load GeoIP database: ${e.message}`, e.stack);
        }
    }

    public resolve(ip: string): GeoResult {
        if (!this.lookup) {
            return { country: null, city: null };
        }

        try {
            if (!maxmind.validate(ip)) {
                return { country: null, city: null };
            }
            const result = this.lookup.get(ip);
            return {
                country: result?.country?.iso_code || null,
                city: result?.city?.names?.en || null,
            };
        } catch (e) {
            this.logger.warn(`Error resolving IP ${ip}: ${e.message}`);
            return { country: null, city: null };
        }
    }

    /** @deprecated Use resolve() instead */
    public getCountry(ip: string): string | null {
        return this.resolve(ip).country;
    }
}
