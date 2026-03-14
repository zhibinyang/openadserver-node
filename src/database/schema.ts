
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
    index,
    primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { Status, BidType, PacingType, CreativeType, EventType } from '../shared/types';

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
    pacing_type: integer('pacing_type').default(PacingType.EVEN),

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
    duration: integer('duration'), // Video duration in seconds

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

// --- AUDIENCE INTERESTS ---
export const audience_interests = pgTable('audience_interests', {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 100 }).notNull().unique(), // e.g. 'tech', 'sports'
    name: varchar('name', { length: 255 }).notNull(), // e.g. 'Technology', 'Sports & Fitness'
    description: text('description'),
    status: integer('status').default(Status.ACTIVE),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// --- AD EVENTS ---
export const ad_events = pgTable('ad_events', {
    id: serial('id').primaryKey(),
    request_id: varchar('request_id', { length: 64 }).notNull(), // indexed in SQL
    click_id: varchar('click_id', { length: 64 }), // Unique click identifier, indexed

    campaign_id: integer('campaign_id').references(() => campaigns.id),
    creative_id: integer('creative_id').references(() => creatives.id),

    user_id: varchar('user_id', { length: 255 }),

    device: varchar('device', { length: 255 }),
    browser: varchar('browser', { length: 255 }),

    event_type: integer('event_type').default(EventType.IMPRESSION),
    event_time: timestamp('event_time').notNull(),

    ip: varchar('ip', { length: 45 }), // IPv6 support
    country: varchar('country', { length: 2 }), // ISO 3166-1 alpha-2
    city: varchar('city', { length: 255 }),

    bid: numeric('bid', { precision: 12, scale: 6 }).default('0'),
    price: numeric('price', { precision: 12, scale: 6 }).default('0'), // Actual price paid

    pctr: numeric('pctr', { precision: 12, scale: 6 }).default('0'),
    pcvr: numeric('pcvr', { precision: 12, scale: 6 }).default('0'),

    cost: numeric('cost', { precision: 12, scale: 6 }).default('0'),

    // New fields
    os: varchar('os', { length: 50 }),
    conversion_value: numeric('conversion_value', { precision: 12, scale: 6 }),
    video_duration: integer('video_duration'),         // seconds
    banner_width: integer('banner_width'),
    banner_height: integer('banner_height'),
    referer: varchar('referer', { length: 2048 }),
    slot_type: integer('slot_type'),                   // CreativeType enum
    slot_id: varchar('slot_id', { length: 255 }),
    bid_type: integer('bid_type'),                     // BidType enum (1=CPM, 2=CPC, 3=CPA, 4=OCPM)
    ecpm: numeric('ecpm', { precision: 12, scale: 6 }),
    page_context: varchar('page_context', { length: 2048 }),
}, (table) => ({
    // Create index on click_id for fast lookups
    clickIdIdx: index('ad_events_click_id_idx').on(table.click_id),
}));

export const ad_eventsRelations = relations(ad_events, ({ one }) => ({
    campaign: one(campaigns, {
        fields: [ad_events.campaign_id],
        references: [campaigns.id],
    }),
    creative: one(creatives, {
        fields: [ad_events.creative_id],
        references: [creatives.id],
    }),
}));

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

// --- CAMPAIGN HOURLY PERFORMANCE ---
export const campaign_hourly_performance = pgTable('campaign_hourly_performance', {
    id: serial('id').primaryKey(),
    log_timestamp: timestamp('log_timestamp').notNull(),
    campaign_id: integer('campaign_id').notNull(),
    campaign_name: varchar('campaign_name', { length: 255 }),
    advertiser_id: integer('advertiser_id'),
    status: integer('status'),
    is_active: boolean('is_active'),
    bid_type: integer('bid_type'),
    bid_amount: numeric('bid_amount', { precision: 12, scale: 4 }),
    pacing_type: integer('pacing_type'),
    start_time: timestamp('start_time'),
    end_time: timestamp('end_time'),
    budget_daily: numeric('budget_daily', { precision: 12, scale: 4 }),
    budget_total: numeric('budget_total', { precision: 12, scale: 4 }),
    spent_today: numeric('spent_today', { precision: 12, scale: 4 }),
    spent_total: numeric('spent_total', { precision: 12, scale: 4 }),
    billable_count_today: integer('billable_count_today'),
    billable_count_total: integer('billable_count_total'),
});

// --- USER PROFILES ---
export const user_profiles = pgTable('user_profiles', {
    id: serial('id').primaryKey(),
    user_id: varchar('user_id', { length: 255 }).notNull().unique(),
    
    // Demographics
    age: integer('age'),
    gender: varchar('gender', { length: 20 }).default('unknown'), // 'male' / 'female' / 'other' / 'unknown'
    
    // Interests & Tags
    interests: json('interests').default([]), // Array of interest codes
    tags: json('tags').default([]), // Array of custom tags
    
    // Custom attributes
    custom_attributes: json('custom_attributes').default({}), // Key-value custom attributes
    
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// --- SEGMENTS (人群包) ---
export const segments = pgTable('segments', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 50 }).notNull().default('custom'), // custom / behavior / lookalike
    status: integer('status').default(1), // 1=active, 0=inactive
    user_count: integer('user_count').default(0),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// --- SEGMENT USERS (人群包用户关联) ---
export const segment_users = pgTable('segment_users', {
    segment_id: integer('segment_id').notNull().references(() => segments.id, { onDelete: 'cascade' }),
    user_id: varchar('user_id', { length: 255 }).notNull(),
    added_at: timestamp('added_at').defaultNow().notNull(),
    expires_at: timestamp('expires_at'),
}, (table) => ({
    pk: primaryKey({ columns: [table.segment_id, table.user_id] }),
    userIdIdx: index('segment_users_user_id_idx').on(table.user_id),
    expiresAtIdx: index('segment_users_expires_at_idx').on(table.expires_at),
}));
