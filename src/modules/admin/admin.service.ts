
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { eq, desc } from 'drizzle-orm';
import {
    CreateAdvertiserDto, UpdateAdvertiserDto,
    CreateCampaignDto, UpdateCampaignDto,
    CreateCreativeDto, UpdateCreativeDto,
    CreateTargetingRuleDto, UpdateTargetingRuleDto
} from './dto/admin.dto';

@Injectable()
export class AdminService {
    constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) { }

    // --- Advertisers ---
    async getAdvertisers() {
        return this.db.query.advertisers.findMany({
            orderBy: [desc(schema.advertisers.id)],
        });
    }

    async createAdvertiser(data: CreateAdvertiserDto) {
        return this.db.insert(schema.advertisers)
            .values({
                ...data,
                balance: data.balance?.toString(),
                daily_budget: data.daily_budget?.toString()
            })
            .returning();
    }

    async updateAdvertiser(id: number, data: UpdateAdvertiserDto) {
        const updateData: any = { ...data };
        if (data.balance !== undefined) updateData.balance = data.balance.toString();
        if (data.daily_budget !== undefined) updateData.daily_budget = data.daily_budget.toString();

        // Explicitly strip read-only/complex fields to prevent Drizzle mapping errors
        delete updateData.id;
        delete updateData.created_at;
        delete updateData.updated_at;

        return this.db.update(schema.advertisers)
            .set({ ...updateData, updated_at: new Date() })
            .where(eq(schema.advertisers.id, id))
            .returning();
    }

    async deleteAdvertiser(id: number) {
        return this.db.delete(schema.advertisers)
            .where(eq(schema.advertisers.id, id))
            .returning();
    }

    // --- Campaigns ---
    async getCampaigns(advertiserId?: number) {
        return this.db.query.campaigns.findMany({
            where: advertiserId ? eq(schema.campaigns.advertiser_id, advertiserId) : undefined,
            orderBy: [desc(schema.campaigns.id)],
            with: {
                advertiser: true
            }
        });
    }

    async createCampaign(data: CreateCampaignDto) {
        return this.db.insert(schema.campaigns)
            .values({
                ...data,
                budget_daily: data.budget_daily?.toString(),
                budget_total: data.budget_total?.toString(),
                bid_amount: data.bid_amount?.toString(),
            })
            .returning();
    }

    async updateCampaign(id: number, data: UpdateCampaignDto) {
        const updateData: any = { ...data };
        if (data.budget_daily !== undefined) updateData.budget_daily = data.budget_daily.toString();
        if (data.budget_total !== undefined) updateData.budget_total = data.budget_total.toString();
        if (data.bid_amount !== undefined) updateData.bid_amount = data.bid_amount.toString();

        delete updateData.id;
        delete updateData.advertiser;
        delete updateData.created_at;
        delete updateData.updated_at;

        return this.db.update(schema.campaigns)
            .set({ ...updateData, updated_at: new Date() })
            .where(eq(schema.campaigns.id, id))
            .returning();
    }

    async deleteCampaign(id: number) {
        return this.db.delete(schema.campaigns)
            .where(eq(schema.campaigns.id, id))
            .returning();
    }

    // --- Creatives ---
    async getCreatives(campaignId?: number) {
        return this.db.query.creatives.findMany({
            where: campaignId ? eq(schema.creatives.campaign_id, campaignId) : undefined,
            orderBy: [desc(schema.creatives.id)],
            with: {
                campaign: true
            }
        });
    }

    async createCreative(data: CreateCreativeDto) {
        return this.db.insert(schema.creatives)
            .values(data)
            .returning();
    }

    async updateCreative(id: number, data: UpdateCreativeDto) {
        const updateData: any = { ...data };
        delete updateData.id;
        delete updateData.campaign;
        delete updateData.created_at;
        delete updateData.updated_at;

        return this.db.update(schema.creatives)
            .set({ ...updateData, updated_at: new Date() })
            .where(eq(schema.creatives.id, id))
            .returning();
    }

    async deleteCreative(id: number) {
        return this.db.delete(schema.creatives)
            .where(eq(schema.creatives.id, id))
            .returning();
    }

    // --- Targeting Rules ---
    async getTargetingRules(campaignId?: number) {
        return this.db.query.targeting_rules.findMany({
            where: campaignId ? eq(schema.targeting_rules.campaign_id, campaignId) : undefined,
            orderBy: [desc(schema.targeting_rules.id)],
            with: {
                campaign: true
            }
        });
    }

    async createTargetingRule(data: CreateTargetingRuleDto) {
        return this.db.insert(schema.targeting_rules)
            .values(data)
            .returning();
    }

    async updateTargetingRule(id: number, data: UpdateTargetingRuleDto) {
        const updateData: any = { ...data };
        delete updateData.id;
        delete updateData.campaign;
        delete updateData.created_at;
        delete updateData.updated_at;

        return this.db.update(schema.targeting_rules)
            .set({ ...updateData, updated_at: new Date() })
            .where(eq(schema.targeting_rules.id, id))
            .returning();
    }

    async deleteTargetingRule(id: number) {
        return this.db.delete(schema.targeting_rules)
            .where(eq(schema.targeting_rules.id, id))
            .returning();
    }

    // --- Ad Events ---
    async getAdEvents(limit: number = 100) {
        return this.db.query.ad_events.findMany({
            orderBy: [desc(schema.ad_events.event_time)],
            limit,
            with: {
                campaign: true,
                creative: true,
            }
        });
    }
}
