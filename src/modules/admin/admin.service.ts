
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { eq, desc } from 'drizzle-orm';
import { RedisService } from '../../shared/redis/redis.service';
import {
    CreateAdvertiserDto, UpdateAdvertiserDto,
    CreateCampaignDto, UpdateCampaignDto,
    CreateCreativeDto, UpdateCreativeDto,
    CreateTargetingRuleDto, UpdateTargetingRuleDto
} from './dto/admin.dto';

@Injectable()
export class AdminService {
    constructor(
        @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
        private redisService: RedisService
    ) { }

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
                start_time: data.start_time ? new Date(data.start_time) : undefined,
                end_time: data.end_time ? new Date(data.end_time) : undefined,
            })
            .returning();
    }

    async updateCampaign(id: number, data: UpdateCampaignDto) {
        const updateData: any = { ...data };
        if (data.budget_daily !== undefined) updateData.budget_daily = data.budget_daily.toString();
        if (data.budget_total !== undefined) updateData.budget_total = data.budget_total.toString();
        if (data.bid_amount !== undefined) updateData.bid_amount = data.bid_amount.toString();

        // Convert strings to Dates
        if (data.start_time !== undefined) {
            updateData.start_time = data.start_time ? new Date(data.start_time) : null;
        }
        if (data.end_time !== undefined) {
            updateData.end_time = data.end_time ? new Date(data.end_time) : null;
        }

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

    // --- Audience Interests ---
    async getInterests() {
        return this.db.query.audience_interests.findMany({
            orderBy: [desc(schema.audience_interests.id)],
        });
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

    // --- Pacing ---
    async getPacing() {
        const campaigns = await this.db.query.campaigns.findMany({
            orderBy: [desc(schema.campaigns.id)],
        });

        const date = new Date().toISOString().split('T')[0];
        const pipeline = this.redisService.client.pipeline();

        campaigns.forEach(c => {
            const dailyKey = `budget:${c.id}:${date}`;
            const totalKey = `budget:total:${c.id}`;
            pipeline.hmget(dailyKey, 'spent_today', 'count_today');
            pipeline.hmget(totalKey, 'spent_total', 'count_total');
        });

        const results = await pipeline.exec();
        const pacingInfo = [];

        const now = new Date();
        const secSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const dailyTimeProgress = secSinceMidnight / 86400;

        for (let i = 0; i < campaigns.length; i++) {
            const c = campaigns[i];
            const [errDaily, valDaily] = results![i * 2];
            const [errTotal, valTotal] = results![i * 2 + 1];

            const spentToday = parseFloat((valDaily as (string | null)[])?.[0] || '0');
            const countToday = parseInt((valDaily as (string | null)[])?.[1] || '0', 10);

            const spentTotal = parseFloat((valTotal as (string | null)[])?.[0] || '0');
            const countTotal = parseInt((valTotal as (string | null)[])?.[1] || '0', 10);

            const dailyLimit = c.budget_daily ? parseFloat(c.budget_daily) : 0;
            const pacingType = c.pacing_type || 1;
            let targetToday = 0;

            if (pacingType === 1) { // Even
                targetToday = dailyLimit * dailyTimeProgress;
            } else if (pacingType === 2) { // Aggressive
                targetToday = dailyLimit * Math.min(dailyTimeProgress * 1.3, 1.0);
            } else if (pacingType === 3) { // Daily ASAP
                targetToday = dailyLimit;
            }

            pacingInfo.push({
                campaign_id: c.id,
                name: c.name,
                pacing_type: c.pacing_type,
                budget_daily: dailyLimit,
                target_today: parseFloat(targetToday.toFixed(2)),
                spent_today: spentToday,
                billable_count_today: countToday,
                budget_total: c.budget_total ? parseFloat(c.budget_total) : 0,
                spent_total: spentTotal,
                billable_count_total: countTotal,
            });
        }

        return pacingInfo;
    }
}
