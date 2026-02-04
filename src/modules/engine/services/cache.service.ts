
import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DRIZZLE } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { Status, CreativeType, BidType } from '../../../shared/types';
import { Cron, CronExpression } from '@nestjs/schedule';

// Internal types for the cache
export type CachedCampaign = typeof schema.campaigns.$inferSelect;
export type CachedCreative = typeof schema.creatives.$inferSelect;
export type CachedRule = typeof schema.targeting_rules.$inferSelect;

@Injectable()
export class CacheService implements OnModuleInit {
    private readonly logger = new Logger(CacheService.name);

    // In-memory stores
    private campaigns: Map<number, CachedCampaign> = new Map();
    private creatives: Map<number, CachedCreative[]> = new Map(); // Grouped by campaign_id
    private rules: Map<number, CachedRule[]> = new Map(); // Grouped by campaign_id

    // Fast access indices
    private allCreatives: CachedCreative[] = [];

    constructor(
        @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
    ) { }

    async onModuleInit() {
        this.logger.log('Initializing CacheService...');
        await this.refresh();
    }

    /**
     * Refresh all in-memory data from the database.
     * Runs on startup and periodically.
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async refresh() {
        this.logger.log('Refreshing cache from database...');
        const start = Date.now();

        try {
            // 1. Fetch Campaigns (Active only)
            const campaignsData = await this.db.query.campaigns.findMany({
                where: and(
                    eq(schema.campaigns.status, Status.ACTIVE),
                    eq(schema.campaigns.is_active, true)
                ),
            });

            // 2. Fetch Creatives (Active only)
            // Note: In a real large-scale system, we might filter by active campaigns here too,
            // but for simplicity and to ensure referential integrity in cache, we load active creatives.
            const creativesData = await this.db.query.creatives.findMany({
                where: eq(schema.creatives.status, Status.ACTIVE),
            });

            // 3. Fetch Targeting Rules
            const rulesData = await this.db.query.targeting_rules.findMany();

            // 4. Rebuild Maps (Atomic replacement typical in other languages, here JS is single threaded so safe-ish)
            const newCampaigns = new Map<number, CachedCampaign>();
            const newCreatives = new Map<number, CachedCreative[]>();
            const newRules = new Map<number, CachedRule[]>();

            // Process Campaigns
            for (const campaign of campaignsData) {
                newCampaigns.set(campaign.id, campaign);
            }

            // Process Creatives
            for (const creative of creativesData) {
                // Only add if campaign exists (ensure consistency)
                if (newCampaigns.has(creative.campaign_id)) {
                    if (!newCreatives.has(creative.campaign_id)) {
                        newCreatives.set(creative.campaign_id, []);
                    }
                    newCreatives.get(creative.campaign_id)?.push(creative);
                }
            }

            // Process Rules
            for (const rule of rulesData) {
                if (newCampaigns.has(rule.campaign_id)) {
                    if (!newRules.has(rule.campaign_id)) {
                        newRules.set(rule.campaign_id, []);
                    }
                    newRules.get(rule.campaign_id)?.push(rule);
                }
            }

            // Update State
            this.campaigns = newCampaigns;
            this.creatives = newCreatives;
            this.rules = newRules;
            this.allCreatives = creativesData.filter(c => newCampaigns.has(c.campaign_id));

            this.logger.log(
                `Cache refreshed in ${Date.now() - start}ms. ` +
                `Loaded: ${this.campaigns.size} campaigns, ${this.allCreatives.length} creatives, ${rulesData.length} rules.`
            );

        } catch (error) {
            this.logger.error('Failed to refresh cache', error);
            // In production, you might want to alert here.
            // We do NOT clear the existing cache to serve stale data rather than nothing.
        }
    }

    // --- Accessors ---

    getCampaign(id: number): CachedCampaign | undefined {
        return this.campaigns.get(id);
    }

    getAllCampaigns(): CachedCampaign[] {
        return Array.from(this.campaigns.values());
    }

    getCreativesForCampaign(campaignId: number): CachedCreative[] {
        return this.creatives.get(campaignId) || [];
    }

    getRulesForCampaign(campaignId: number): CachedRule[] {
        return this.rules.get(campaignId) || [];
    }

    getAllCreatives(): CachedCreative[] {
        return this.allCreatives;
    }
}
