import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as maxmind from 'maxmind';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class GeoIpService implements OnModuleInit {
    private readonly logger = new Logger(GeoIpService.name);
    private lookup: maxmind.Reader<maxmind.CountryResponse> | null = null;

    async onModuleInit() {
        const dbPath = process.env.GEO_DB_PATH || path.join(process.cwd(), 'models', 'GeoLite2-Country.mmdb');

        if (!fs.existsSync(dbPath)) {
            this.logger.warn(`GeoIP database not found at ${dbPath}. Country resolution will be disabled.`);
            return;
        }

        try {
            this.lookup = await maxmind.open<maxmind.CountryResponse>(dbPath);
            this.logger.log(`Loaded GeoIP database from ${dbPath}`);
        } catch (e) {
            this.logger.error(`Failed to load GeoIP database: ${e.message}`, e.stack);
        }
    }

    public getCountry(ip: string): string | null {
        if (!this.lookup) {
            return null;
        }

        try {
            // maxmind.validate(ip) checks if it's a valid IP
            if (!maxmind.validate(ip)) {
                return null;
            }
            const result = this.lookup.get(ip);
            return result?.country?.iso_code || null;
        } catch (e) {
            this.logger.warn(`Error resolving IP ${ip}: ${e.message}`);
            return null;
        }
    }
}
