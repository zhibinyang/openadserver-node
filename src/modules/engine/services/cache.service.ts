
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
export type CachedInterest = typeof schema.audience_interests.$inferSelect;
export type CachedAdGroup = typeof schema.ad_groups.$inferSelect;
export type CachedApp = typeof schema.apps.$inferSelect;
export type CachedSlot = typeof schema.slots.$inferSelect;
export type CachedCreativeRendition = typeof schema.creative_renditions.$inferSelect;

@Injectable()
export class CacheService implements OnModuleInit {
    private readonly logger = new Logger(CacheService.name);

    // In-memory stores
    private campaigns: Map<number, CachedCampaign> = new Map();
    private creatives: Map<number, CachedCreative[]> = new Map(); // Grouped by campaign_id
    private rulesByAdGroup: Map<number, CachedRule[]> = new Map(); // Grouped by ad_group_id
    private interests: Map<string, CachedInterest> = new Map(); // Keyed by code
    private adGroups: Map<number, CachedAdGroup> = new Map();
    private adGroupsByCampaign: Map<number, CachedAdGroup[]> = new Map(); // Grouped by campaign_id
    private apps: Map<number, CachedApp> = new Map();
    private slots: Map<number, CachedSlot> = new Map();
    private slotsByApp: Map<number, CachedSlot[]> = new Map(); // Grouped by app_id
    private creativeRenditions: Map<number, CachedCreativeRendition[]> = new Map(); // Grouped by creative_id

    // Fast access indices
    private allCreatives: CachedCreative[] = [];
    // OPTIMIZATION 2: Indexed cache by slot_id for O(1) retrieval
    private creativesBySlot: Map<string, CachedCreative[]> = new Map();

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

            // 2. Fetch Ad Groups (Active only)
            const adGroupsData = await this.db.query.ad_groups.findMany({
                where: eq(schema.ad_groups.status, Status.ACTIVE),
            });

            // 3. Fetch Creatives (Active only)
            // Note: In a real large-scale system, we might filter by active campaigns here too,
            // but for simplicity and to ensure referential integrity in cache, we load active creatives.
            const creativesData = await this.db.query.creatives.findMany({
                where: eq(schema.creatives.status, Status.ACTIVE),
            });

            // 4. Fetch Creative Renditions (Active only)
            const creativeRenditionsData = await this.db.query.creative_renditions.findMany({
                where: eq(schema.creative_renditions.status, Status.ACTIVE),
            });

            // 5. Fetch Targeting Rules
            const rulesData = await this.db.query.targeting_rules.findMany();

            // 6. Fetch Audience Interests (Active only)
            const interestsData = await this.db.query.audience_interests.findMany({
                where: eq(schema.audience_interests.status, Status.ACTIVE),
            });

            // 7. Fetch Apps (Supply Side, Active only)
            const appsData = await this.db.query.apps.findMany({
                where: eq(schema.apps.status, Status.ACTIVE),
            });

            // 8. Fetch Ad Slots (Supply Side, Active only)
            const slotsData = await this.db.query.slots.findMany({
                where: eq(schema.slots.status, Status.ACTIVE),
            });

            // 9. Rebuild Maps (Atomic replacement typical in other languages, here JS is single threaded so safe-ish)
            const newCampaigns = new Map<number, CachedCampaign>();
            const newAdGroups = new Map<number, CachedAdGroup>();
            const newAdGroupsByCampaign = new Map<number, CachedAdGroup[]>();
            const newCreatives = new Map<number, CachedCreative[]>();
            const newCreativeRenditions = new Map<number, CachedCreativeRendition[]>();
            const newRulesByAdGroup = new Map<number, CachedRule[]>();
            const newInterests = new Map<string, CachedInterest>();
            const newApps = new Map<number, CachedApp>();
            const newSlots = new Map<number, CachedSlot>();
            const newSlotsByApp = new Map<number, CachedSlot[]>();

            // Process Campaigns
            for (const campaign of campaignsData) {
                newCampaigns.set(Number(campaign.id), campaign);
            }

            // Process Ad Groups
            for (const adGroup of adGroupsData) {
                const campaignId = Number(adGroup.campaign_id);
                if (newCampaigns.has(campaignId)) {
                    newAdGroups.set(Number(adGroup.id), adGroup);
                    if (!newAdGroupsByCampaign.has(campaignId)) {
                        newAdGroupsByCampaign.set(campaignId, []);
                    }
                    newAdGroupsByCampaign.get(campaignId)?.push(adGroup);
                }
            }

            // Process Creatives
            for (const creative of creativesData) {
                // Only add if campaign exists (ensure consistency)
                const campaignId = Number(creative.campaign_id);
                if (newCampaigns.has(campaignId)) {
                    if (!newCreatives.has(campaignId)) {
                        newCreatives.set(campaignId, []);
                    }
                    newCreatives.get(campaignId)?.push(creative);
                }
            }

            // Process Creative Renditions
            for (const rendition of creativeRenditionsData) {
                const creativeId = Number(rendition.creative_id);
                if (!newCreativeRenditions.has(creativeId)) {
                    newCreativeRenditions.set(creativeId, []);
                }
                newCreativeRenditions.get(creativeId)?.push(rendition);
            }

            // Process Rules (only ad-group-level now)
            for (const rule of rulesData) {
                const adGroupId = Number(rule.ad_group_id);
                if (newAdGroups.has(adGroupId)) {
                    if (!newRulesByAdGroup.has(adGroupId)) {
                        newRulesByAdGroup.set(adGroupId, []);
                    }
                    newRulesByAdGroup.get(adGroupId)?.push(rule);
                }
            }

            // Process Interests
            for (const interest of interestsData) {
                newInterests.set(interest.code, interest);
            }

            // Process Apps
            for (const app of appsData) {
                newApps.set(Number(app.id), app);
            }

            // Process Slots
            for (const slot of slotsData) {
                const appId = Number(slot.app_id);
                if (newApps.has(appId)) {
                    newSlots.set(Number(slot.id), slot);
                    if (!newSlotsByApp.has(appId)) {
                        newSlotsByApp.set(appId, []);
                    }
                    newSlotsByApp.get(appId)?.push(slot);
                }
            }

            // Update State
            this.campaigns = newCampaigns;
            this.adGroups = newAdGroups;
            this.adGroupsByCampaign = newAdGroupsByCampaign;
            this.creatives = newCreatives;
            this.creativeRenditions = newCreativeRenditions;
            this.rulesByAdGroup = newRulesByAdGroup;
            this.interests = newInterests;
            this.apps = newApps;
            this.slots = newSlots;
            this.slotsByApp = newSlotsByApp;
            this.allCreatives = creativesData.filter(c => newCampaigns.has(Number(c.campaign_id)));

            // OPTIMIZATION 2: Build slot_id index
            this.buildSlotIndex();

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

    getAllCreatives(): CachedCreative[] {
        return this.allCreatives;
    }

    getAllInterests(): CachedInterest[] {
        return Array.from(this.interests.values());
    }

    getInterest(code: string): CachedInterest | undefined {
        return this.interests.get(code);
    }

    // --- New Architecture Accessors ---

    getAdGroup(id: number): CachedAdGroup | undefined {
        return this.adGroups.get(id);
    }

    getAdGroupsForCampaign(campaignId: number): CachedAdGroup[] {
        return this.adGroupsByCampaign.get(campaignId) || [];
    }

    getRulesForAdGroup(adGroupId: number): CachedRule[] {
        return this.rulesByAdGroup.get(adGroupId) || [];
    }

    getCreativeRenditionsForCreative(creativeId: number): CachedCreativeRendition[] {
        return this.creativeRenditions.get(creativeId) || [];
    }

    getApp(id: number): CachedApp | undefined {
        return this.apps.get(id);
    }

    getSlot(id: number): CachedSlot | undefined {
        return this.slots.get(id);
    }

    getSlotsForApp(appId: number): CachedSlot[] {
        return this.slotsByApp.get(appId) || [];
    }

    /**
     * OPTIMIZATION 2: Get creatives by slot_id in O(1).
     * Currently we don't have slot_id in schema, so returns all.
     * When slot_id is added, this will provide indexed access.
     */
    getCreativesBySlot(slotId?: string): CachedCreative[] {
        if (!slotId) return this.allCreatives;
        return this.creativesBySlot.get(slotId) || this.allCreatives;
    }

    /**
     * Build slot_id index during cache refresh.
     * When slot_id column exists, group creatives by it.
     */
    private buildSlotIndex() {
        // TODO: Group by slot_id when column exists
        // For now, map all slots to all creatives as fallback
        this.creativesBySlot.clear();
        this.creativesBySlot.set('default', this.allCreatives);
    }
}
