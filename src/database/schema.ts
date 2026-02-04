
import {
    pgTable,
    serial,
    integer,
    varchar,
    numeric,
    timestamp,
    text,
    boolean,
    json,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { Status, BidType, CreativeType, EventType } from '../shared/types';

// --- ADVERTISERS ---
export const advertisers = pgTable('advertisers', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    company: varchar('company', { length: 255 }),
    contact_email: varchar('contact_email', { length: 255 }),
    // Numeric types in Postgres return as string in JS, use parseFloat when reading if needed
    balance: numeric('balance', { precision: 12, scale: 4 }).default('0'),
    daily_budget: numeric('daily_budget', { precision: 12, scale: 4 }).default('0'),
    status: integer('status').default(Status.ACTIVE),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const advertisersRelations = relations(advertisers, ({ many }) => ({
    campaigns: many(campaigns),
}));

// --- CAMPAIGNS ---
export const campaigns = pgTable('campaigns', {
    id: serial('id').primaryKey(),
    advertiser_id: integer('advertiser_id')
        .notNull()
        .references(() => advertisers.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Budget
    budget_daily: numeric('budget_daily', { precision: 12, scale: 4 }).default('0'),
    budget_total: numeric('budget_total', { precision: 12, scale: 4 }).default('0'),
    spent_today: numeric('spent_today', { precision: 12, scale: 4 }).default('0'),
    spent_total: numeric('spent_total', { precision: 12, scale: 4 }).default('0'),

    // Bidding
    bid_type: integer('bid_type').default(BidType.CPM),
    bid_amount: numeric('bid_amount', { precision: 12, scale: 4 }).default('0'),

    // Frequency cap
    freq_cap_daily: integer('freq_cap_daily').default(10),
    freq_cap_hourly: integer('freq_cap_hourly').default(3),

    // Schedule
    start_time: timestamp('start_time'),
    end_time: timestamp('end_time'),

    // Status
    status: integer('status').default(Status.ACTIVE),
    is_active: boolean('is_active').default(true),

    // Stats (cached)
    impressions: integer('impressions').default(0),
    clicks: integer('clicks').default(0),
    conversions: integer('conversions').default(0),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
    advertiser: one(advertisers, {
        fields: [campaigns.advertiser_id],
        references: [advertisers.id],
    }),
    creatives: many(creatives),
    targeting_rules: many(targeting_rules),
}));

// --- CREATIVES ---
export const creatives = pgTable('creatives', {
    id: serial('id').primaryKey(),
    campaign_id: integer('campaign_id')
        .notNull()
        .references(() => campaigns.id),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    image_url: varchar('image_url', { length: 1024 }),
    video_url: varchar('video_url', { length: 1024 }),
    landing_url: varchar('landing_url', { length: 1024 }).notNull(),

    // Creative metadata
    creative_type: integer('creative_type').default(CreativeType.BANNER),
    width: integer('width').default(0),
    height: integer('height').default(0),

    // Status
    status: integer('status').default(Status.ACTIVE),

    // Quality score
    quality_score: integer('quality_score').default(80),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const creativesRelations = relations(creatives, ({ one }) => ({
    campaign: one(campaigns, {
        fields: [creatives.campaign_id],
        references: [campaigns.id],
    }),
}));

// --- TARGETING RULES ---
export const targeting_rules = pgTable('targeting_rules', {
    id: serial('id').primaryKey(),
    campaign_id: integer('campaign_id')
        .notNull()
        .references(() => campaigns.id),
    // Rule type: geo, device, age, gender, etc.
    rule_type: varchar('rule_type', { length: 50 }).notNull(),
    // JSON rule value
    rule_value: json('rule_value').notNull(),
    // Include (whitelist) or exclude (blacklist)
    is_include: boolean('is_include').default(true),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const targetingRulesRelations = relations(targeting_rules, ({ one }) => ({
    campaign: one(campaigns, {
        fields: [targeting_rules.campaign_id],
        references: [campaigns.id],
    }),
}));

// --- AD EVENTS ---
export const ad_events = pgTable('ad_events', {
    id: serial('id').primaryKey(),
    request_id: varchar('request_id', { length: 64 }).notNull(), // indexed in SQL

    campaign_id: integer('campaign_id').references(() => campaigns.id),
    creative_id: integer('creative_id').references(() => creatives.id),

    user_id: varchar('user_id', { length: 255 }),

    event_type: integer('event_type').default(EventType.IMPRESSION),
    event_time: timestamp('event_time').notNull(),

    cost: numeric('cost', { precision: 12, scale: 6 }).default('0'),
});

// --- HOURLY STATS ---
export const hourly_stats = pgTable('hourly_stats', {
    id: serial('id').primaryKey(),
    campaign_id: integer('campaign_id')
        .notNull()
        .references(() => campaigns.id),
    stat_hour: timestamp('stat_hour').notNull(),

    impressions: integer('impressions').default(0),
    clicks: integer('clicks').default(0),
    conversions: integer('conversions').default(0),
    spend: numeric('spend', { precision: 12, scale: 4 }).default('0'),

    ctr: numeric('ctr', { precision: 8, scale: 6 }).default('0'),
    cvr: numeric('cvr', { precision: 8, scale: 6 }).default('0'),
});
