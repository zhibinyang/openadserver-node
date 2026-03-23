
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
import { Status, BidType, PacingType, CreativeType, EventType, IABCategory, SlotType, MarketingGoal } from '../shared/types';

// --- ADVERTISERS ---
export const advertisers = pgTable('advertisers', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    company: varchar('company', { length: 255 }),
    contact_email: varchar('contact_email', { length: 255 }),
    // Numeric types in Postgres return as string in JS, use parseFloat when reading if needed
    balance: numeric('balance', { precision: 12, scale: 4 }).default('0'),
    daily_budget: numeric('daily_budget', { precision: 12, scale: 4 }).default('0'),
    brand_weight: numeric('brand_weight', { precision: 6, scale: 4 }).default('1.0'),
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
    bid_amount: numeric('bid_amount', { precision: 12, scale: 4 }).default('0'), // For GEO and legacy
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
    ad_groups: many(ad_groups),
    targeting_rules: many(targeting_rules),
}));

// --- CREATIVES ---
export const creatives = pgTable('creatives', {
    id: serial('id').primaryKey(),
    campaign_id: integer('campaign_id')
        .notNull()
        .references(() => campaigns.id),
    ad_group_id: integer('ad_group_id')
        .references(() => ad_groups.id), // New: optional ad group association
    ad_category_id: integer('ad_category_id')
        .references(() => app_categories.id), // New: optional ad category

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

    // Frequency cap
    freq_cap_daily: integer('freq_cap_daily').default(10),
    freq_cap_hourly: integer('freq_cap_hourly').default(3),

    // Status
    status: integer('status').default(Status.ACTIVE),

    // Quality score
    quality_score: integer('quality_score').default(80),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const creativesRelations = relations(creatives, ({ one, many }) => ({
    campaign: one(campaigns, {
        fields: [creatives.campaign_id],
        references: [campaigns.id],
    }),
    ad_group: one(ad_groups, {
        fields: [creatives.ad_group_id],
        references: [ad_groups.id],
    }),
    ad_category: one(app_categories, {
        fields: [creatives.ad_category_id],
        references: [app_categories.id],
    }),
    creative_renditions: many(creative_renditions),
}));

// --- TARGETING RULES ---
export const targeting_rules = pgTable('targeting_rules', {
    id: serial('id').primaryKey(),
    ad_group_id: integer('ad_group_id')
        .notNull()
        .references(() => ad_groups.id), // Targeting rules are only bound to ad groups

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
    ad_group: one(ad_groups, {
        fields: [targeting_rules.ad_group_id],
        references: [ad_groups.id],
    }),
}));

// --- GEO KNOWLEDGE ---
export const geo_knowledge = pgTable('geo_knowledge', {
    id: serial('id').primaryKey(),
    advertiser_id: integer('advertiser_id')
        .notNull()
        .references(() => advertisers.id),
    campaign_id: integer('campaign_id')
        .references(() => campaigns.id),
    creative_id: integer('creative_id')
        .references(() => creatives.id),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    source_url: varchar('source_url', { length: 1024 }),
    embedding_status: varchar('embedding_status', { length: 20 }).default('pending'),
    milvus_pk: varchar('milvus_pk', { length: 64 }),
    status: integer('status').default(Status.ACTIVE),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    advertiserIdx: index('geo_knowledge_advertiser_id_idx').on(table.advertiser_id),
    campaignIdx: index('geo_knowledge_campaign_id_idx').on(table.campaign_id),
    statusIdx: index('geo_knowledge_status_idx').on(table.status),
}));

export const geoKnowledgeRelations = relations(geo_knowledge, ({ one }) => ({
    advertiser: one(advertisers, {
        fields: [geo_knowledge.advertiser_id],
        references: [advertisers.id],
    }),
    campaign: one(campaigns, {
        fields: [geo_knowledge.campaign_id],
        references: [campaigns.id],
    }),
    creative: one(creatives, {
        fields: [geo_knowledge.creative_id],
        references: [creatives.id],
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

// --- IAB APP CATEGORIES ---
export const app_categories = pgTable('app_categories', {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 20 }).notNull().unique(), // IAB category code (e.g. 'IAB1')
    name: varchar('name', { length: 255 }).notNull(), // Category name
    description: text('description'),
    status: integer('status').default(Status.ACTIVE),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// --- APPS (Supply Side) ---
export const apps = pgTable('apps', {
    id: serial('id').primaryKey(),
    bundle_id: varchar('bundle_id', { length: 255 }).notNull().unique(), // App bundle/package ID
    name: varchar('name', { length: 255 }).notNull(), // App name
    category_id: integer('category_id')
        .references(() => app_categories.id), // IAB category
    publisher_id: integer('publisher_id'), // Publisher ID (future use)
    status: integer('status').default(Status.ACTIVE),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const appsRelations = relations(apps, ({ one, many }) => ({
    category: one(app_categories, {
        fields: [apps.category_id],
        references: [app_categories.id],
    }),
    slots: many(slots),
}));

// --- AD SLOTS (Supply Side) ---
export const slots = pgTable('slots', {
    id: serial('id').primaryKey(),
    app_id: integer('app_id')
        .notNull()
        .references(() => apps.id),
    slot_type: integer('slot_type').default(SlotType.BANNER),
    width: integer('width').default(0),
    height: integer('height').default(0),
    description: text('description'),
    status: integer('status').default(Status.ACTIVE),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const slotsRelations = relations(slots, ({ one }) => ({
    app: one(apps, {
        fields: [slots.app_id],
        references: [apps.id],
    }),
}));

// --- AD GROUPS (Demand Side) ---
export const ad_groups = pgTable('ad_groups', {
    id: serial('id').primaryKey(),
    campaign_id: integer('campaign_id')
        .notNull()
        .references(() => campaigns.id),
    name: varchar('name', { length: 255 }).notNull(),
    marketing_goal: integer('marketing_goal').default(MarketingGoal.PERFORMANCE),
    bid_amount: numeric('bid_amount', { precision: 12, scale: 4 }).default('0'),

    // Frequency cap
    freq_cap_daily: integer('freq_cap_daily').default(10),
    freq_cap_hourly: integer('freq_cap_hourly').default(3),

    status: integer('status').default(Status.ACTIVE),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const adGroupsRelations = relations(ad_groups, ({ one, many }) => ({
    campaign: one(campaigns, {
        fields: [ad_groups.campaign_id],
        references: [campaigns.id],
    }),
    creatives: many(creatives),
    targeting_rules: many(targeting_rules),
    creative_renditions: many(creative_renditions),
}));

// --- CREATIVE RENDITIONS (Physical Material Files) ---
export const creative_renditions = pgTable('creative_renditions', {
    id: serial('id').primaryKey(),
    creative_id: integer('creative_id')
        .notNull()
        .references(() => creatives.id),
    slot_type: integer('slot_type').default(SlotType.BANNER),
    width: integer('width').default(0),
    height: integer('height').default(0),
    file_url: varchar('file_url', { length: 1024 }).notNull(),
    duration: integer('duration'), // Video duration in seconds
    status: integer('status').default(Status.ACTIVE),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const creativeRenditionsRelations = relations(creative_renditions, ({ one }) => ({
    creative: one(creatives, {
        fields: [creative_renditions.creative_id],
        references: [creatives.id],
    }),
}));

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

// --- USER IDENTITIES (用户多ID映射) ---
export const IdentityType = {
    DEVICE_ID: 'device_id',       // 设备ID (cookie, web storage)
    IDFA: 'idfa',                 // iOS Identifier for Advertisers
    GAID: 'gaid',                 // Google Advertising ID
    OAID: 'oaid',                 // Android OAID (中国)
    EMAIL_HASH: 'email_hash',     // Email SHA256 hash
    PHONE_HASH: 'phone_hash',     // Phone SHA256 hash
    CUSTOM: 'custom',             // 自定义ID类型
} as const;

export const user_identities = pgTable('user_identities', {
    user_id: varchar('user_id', { length: 255 }).notNull(),
    identity_type: varchar('identity_type', { length: 50 }).notNull(),
    identity_value: varchar('identity_value', { length: 255 }).notNull(),
    source: varchar('source', { length: 100 }), // 来源标识 (如 'pixel', 'sdk', 'upload')
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    // 联合主键: 同一类型的ID值唯一
    pk: primaryKey({ columns: [table.identity_type, table.identity_value] }),
    // 按user_id查询索引
    userIdIdx: index('user_identities_user_id_idx').on(table.user_id),
    // 按类型查询索引
    typeIdx: index('user_identities_type_idx').on(table.identity_type),
}));

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

// --- BID LOGS (竞价日志) ---
export const bid_logs = pgTable('bid_logs', {
    id: serial('id').primaryKey(),
    request_id: varchar('request_id', { length: 64 }).notNull(),
    bid_id: varchar('bid_id', { length: 64 }),
    imp_id: varchar('imp_id', { length: 64 }),

    ssp_id: varchar('ssp_id', { length: 50 }).notNull(), // SSP adapter ID
    campaign_id: integer('campaign_id').references(() => campaigns.id),
    creative_id: integer('creative_id').references(() => creatives.id),

    // Bid details
    bid_price: numeric('bid_price', { precision: 12, scale: 6 }).default('0'), // Bid amount
    win_price: numeric('win_price', { precision: 12, scale: 6 }), // Actual win price (if won)
    currency: varchar('currency', { length: 3 }).default('USD'),

    // Result: 'bid', 'win', 'loss', 'timeout', 'error'
    result: varchar('result', { length: 20 }).notNull(),

    // Timing
    response_time_ms: integer('response_time_ms'), // Time to process bid

    // Error info
    error_message: text('error_message'),

    // Context
    user_id: varchar('user_id', { length: 255 }),
    ip: varchar('ip', { length: 45 }),
    country: varchar('country', { length: 2 }),
    device: varchar('device', { length: 255 }),
    browser: varchar('browser', { length: 255 }),
    os: varchar('os', { length: 50 }),

    // Slot info
    slot_id: varchar('slot_id', { length: 255 }),
    slot_type: integer('slot_type'),
    slot_width: integer('slot_width'),
    slot_height: integer('slot_height'),

    // Additional data
    ext: json('ext'), // Extra metadata

    created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    requestIdIdx: index('bid_logs_request_id_idx').on(table.request_id),
    sspIdIdx: index('bid_logs_ssp_id_idx').on(table.ssp_id),
    campaignIdIdx: index('bid_logs_campaign_id_idx').on(table.campaign_id),
    resultIdx: index('bid_logs_result_idx').on(table.result),
    createdAtIdx: index('bid_logs_created_at_idx').on(table.created_at),
}));

// --- SSP DAILY STATS (SSP每日统计) ---
export const ssp_daily_stats = pgTable('ssp_daily_stats', {
    id: serial('id').primaryKey(),
    ssp_id: varchar('ssp_id', { length: 50 }).notNull(),
    stat_date: timestamp('stat_date').notNull(),

    // Request stats
    total_requests: integer('total_requests').default(0),
    valid_requests: integer('valid_requests').default(0),
    bid_responses: integer('bid_responses').default(0),
    no_bid_responses: integer('no_bid_responses').default(0),

    // Win/Loss
    wins: integer('wins').default(0),
    losses: integer('losses').default(0),
    timeouts: integer('timeouts').default(0),
    errors: integer('errors').default(0),

    // Financial
    total_bid_value: numeric('total_bid_value', { precision: 16, scale: 6 }).default('0'),
    total_win_value: numeric('total_win_value', { precision: 16, scale: 6 }).default('0'),

    // Performance
    avg_response_time_ms: numeric('avg_response_time_ms', { precision: 10, scale: 2 }),
    avg_bid_price: numeric('avg_bid_price', { precision: 12, scale: 6 }),
    win_rate: numeric('win_rate', { precision: 6, scale: 4 }).default('0'),
    bid_rate: numeric('bid_rate', { precision: 6, scale: 4 }).default('0'),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    sspDateIdx: index('ssp_daily_stats_ssp_date_idx').on(table.ssp_id, table.stat_date),
}));

// --- USERS (管理员用户) ---
export const UserRole = {
    ADMIN: 'admin',
    VIEWER: 'viewer',
} as const;

export const UserStatus = {
    ACTIVE: 1,
    INACTIVE: 0,
} as const;

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 50 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    password_hash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 20 }).notNull().default('viewer'),
    status: integer('status').default(UserStatus.ACTIVE),
    last_login_at: timestamp('last_login_at'),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    usernameIdx: index('users_username_idx').on(table.username),
    emailIdx: index('users_email_idx').on(table.email),
}));

export const usersRelations = relations(users, ({ many }) => ({
    api_keys: many(api_keys),
}));

// --- API KEYS (API密钥) ---
export const ApiKeyStatus = {
    ACTIVE: 1,
    REVOKED: 0,
} as const;

export const api_keys = pgTable('api_keys', {
    id: serial('id').primaryKey(),
    user_id: integer('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    key_hash: varchar('key_hash', { length: 255 }).notNull().unique(),
    key_prefix: varchar('key_prefix', { length: 12 }).notNull(), // First 12 chars for identification
    permissions: json('permissions').default([]), // Array of permission strings
    last_used_at: timestamp('last_used_at'),
    expires_at: timestamp('expires_at'),
    status: integer('status').default(ApiKeyStatus.ACTIVE),

    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    userIdIdx: index('api_keys_user_id_idx').on(table.user_id),
    keyHashIdx: index('api_keys_key_hash_idx').on(table.key_hash),
    keyPrefixIdx: index('api_keys_key_prefix_idx').on(table.key_prefix),
}));

export const apiKeysRelations = relations(api_keys, ({ one }) => ({
    user: one(users, {
        fields: [api_keys.user_id],
        references: [users.id],
    }),
}));
