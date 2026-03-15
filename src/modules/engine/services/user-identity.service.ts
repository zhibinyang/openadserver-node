import { Injectable, Logger, Inject } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service';
import { DRIZZLE } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { IdentityType } from '../../../database/schema';

/**
 * User identity interface
 */
export interface UserIdentity {
    user_id: string;
    identity_type: string;
    identity_value: string;
    source: string | null;
    created_at: Date;
    updated_at: Date;
}

/**
 * Resolve result
 */
export interface ResolveResult {
    user_id: string;
    identity_type: string;
    identity_value: string;
    is_new: boolean; // 是否是新创建的映射
}

@Injectable()
export class UserIdentityService {
    private readonly logger = new Logger(UserIdentityService.name);
    private readonly REDIS_KEY_PREFIX = 'user:identity:';
    private readonly REDIS_USER_IDENTITIES_PREFIX = 'user:identities:';
    private readonly REDIS_EXPIRE_SECONDS = 24 * 60 * 60; // 1 day

    constructor(
        private readonly redisService: RedisService,
        @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    ) { }

    /**
     * 通过任意ID类型解析统一的user_id
     * 如果不存在，则创建新的user_id并建立映射
     *
     * @param identityType ID类型 (device_id, idfa, gaid, etc.)
     * @param identityValue ID值
     * @param source 来源标识
     * @returns ResolveResult 包含user_id和是否新建
     */
    async resolveUserId(
        identityType: string,
        identityValue: string,
        source?: string,
    ): Promise<ResolveResult> {
        if (!identityType || !identityValue) {
            throw new Error('identity_type and identity_value are required');
        }

        // Normalize identity value (trim and lowercase for consistency)
        const normalizedValue = identityValue.trim().toLowerCase();
        const cacheKey = `${this.REDIS_KEY_PREFIX}${identityType}:${normalizedValue}`;

        // 1. Try to get from Redis cache first
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                return {
                    ...parsed,
                    is_new: false,
                };
            } catch (error) {
                this.logger.warn(`Failed to parse cached identity for ${identityType}:${normalizedValue}`);
            }
        }

        // 2. Query from database
        try {
            const identities = await this.db.select()
                .from(schema.user_identities)
                .where(and(
                    eq(schema.user_identities.identity_type, identityType),
                    eq(schema.user_identities.identity_value, normalizedValue),
                ))
                .limit(1);

            if (identities.length > 0) {
                const identity = identities[0];
                const result: ResolveResult = {
                    user_id: identity.user_id,
                    identity_type: identity.identity_type,
                    identity_value: identity.identity_value,
                    is_new: false,
                };

                // Cache the result
                await this.redisService.set(
                    cacheKey,
                    JSON.stringify(result),
                    this.REDIS_EXPIRE_SECONDS,
                );

                return result;
            }
        } catch (error) {
            if (!error.message?.includes('relation "user_identities" does not exist')) {
                this.logger.error(`Failed to query identity for ${identityType}:${normalizedValue}`, error);
                throw error;
            }
            // Table doesn't exist, will create new identity below
        }

        // 3. Not found, create new user_id and mapping
        const newUserId = this.generateUserId();
        const now = new Date();

        try {
            await this.db.insert(schema.user_identities)
                .values({
                    user_id: newUserId,
                    identity_type: identityType,
                    identity_value: normalizedValue,
                    source: source,
                    created_at: now,
                    updated_at: now,
                })
                .onConflictDoNothing(); // Handle race condition

            // Verify the insert (in case of race condition)
            const identities = await this.db.select()
                .from(schema.user_identities)
                .where(and(
                    eq(schema.user_identities.identity_type, identityType),
                    eq(schema.user_identities.identity_value, normalizedValue),
                ))
                .limit(1);

            const userId = identities[0]?.user_id || newUserId;
            const result: ResolveResult = {
                user_id: userId,
                identity_type: identityType,
                identity_value: normalizedValue,
                is_new: true,
            };

            // Cache the result
            await this.redisService.set(
                cacheKey,
                JSON.stringify(result),
                this.REDIS_EXPIRE_SECONDS,
            );

            return result;
        } catch (error) {
            this.logger.error(`Failed to create identity for ${identityType}:${normalizedValue}`, error);
            throw error;
        }
    }

    /**
     * 为已存在的user_id添加新的身份映射
     * 用于合并多个ID到同一个user_id
     *
     * @param userId 统一用户ID
     * @param identityType ID类型
     * @param identityValue ID值
     * @param source 来源
     */
    async addIdentity(
        userId: string,
        identityType: string,
        identityValue: string,
        source?: string,
    ): Promise<void> {
        if (!userId || !identityType || !identityValue) {
            throw new Error('user_id, identity_type and identity_value are required');
        }

        const normalizedValue = identityValue.trim().toLowerCase();
        const now = new Date();

        try {
            await this.db.insert(schema.user_identities)
                .values({
                    user_id: userId,
                    identity_type: identityType,
                    identity_value: normalizedValue,
                    source: source,
                    created_at: now,
                    updated_at: now,
                })
                .onConflictDoUpdate({
                    target: [schema.user_identities.identity_type, schema.user_identities.identity_value],
                    set: {
                        user_id: userId,
                        source: source,
                        updated_at: now,
                    },
                });

            // Invalidate cache
            const cacheKey = `${this.REDIS_KEY_PREFIX}${identityType}:${normalizedValue}`;
            await this.redisService.client.del(cacheKey);

            // Update user identities list cache
            await this.invalidateUserIdentitiesCache(userId);
        } catch (error) {
            this.logger.error(`Failed to add identity for user ${userId}`, error);
            throw error;
        }
    }

    /**
     * 批量添加身份映射
     */
    async addIdentities(
        userId: string,
        identities: Array<{ type: string; value: string; source?: string }>,
    ): Promise<void> {
        if (!userId || !identities.length) return;

        const now = new Date();
        const values = identities.map(id => ({
            user_id: userId,
            identity_type: id.type,
            identity_value: id.value.trim().toLowerCase(),
            source: id.source,
            created_at: now,
            updated_at: now,
        }));

        try {
            for (const value of values) {
                await this.db.insert(schema.user_identities)
                    .values(value)
                    .onConflictDoUpdate({
                        target: [schema.user_identities.identity_type, schema.user_identities.identity_value],
                        set: {
                            user_id: userId,
                            source: value.source,
                            updated_at: now,
                        },
                    });
            }

            // Invalidate caches
            await this.invalidateUserIdentitiesCache(userId);
            for (const id of identities) {
                const cacheKey = `${this.REDIS_KEY_PREFIX}${id.type}:${id.value.trim().toLowerCase()}`;
                await this.redisService.client.del(cacheKey);
            }
        } catch (error) {
            this.logger.error(`Failed to add identities for user ${userId}`, error);
            throw error;
        }
    }

    /**
     * 获取用户的所有身份
     */
    async getUserIdentities(userId: string): Promise<UserIdentity[]> {
        if (!userId) return [];

        // Try cache first
        const cacheKey = `${this.REDIS_USER_IDENTITIES_PREFIX}${userId}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (error) {
                this.logger.warn(`Failed to parse cached identities for user ${userId}`);
            }
        }

        try {
            const identities = await this.db.select()
                .from(schema.user_identities)
                .where(eq(schema.user_identities.user_id, userId));

            // Cache the result
            await this.redisService.set(
                cacheKey,
                JSON.stringify(identities),
                this.REDIS_EXPIRE_SECONDS,
            );

            return identities;
        } catch (error) {
            if (error.message?.includes('relation "user_identities" does not exist')) {
                return [];
            }
            this.logger.error(`Failed to get identities for user ${userId}`, error);
            throw error;
        }
    }

    /**
     * 批量解析用户ID
     * 返回 Map<identity_value, user_id>
     */
    async batchResolveUserIds(
        identityType: string,
        identityValues: string[],
    ): Promise<Map<string, string>> {
        const result = new Map<string, string>();

        if (!identityType || !identityValues.length) return result;

        // Normalize values
        const normalizedValues = identityValues.map(v => v.trim().toLowerCase());

        // Check cache first
        const uncachedValues: string[] = [];
        for (const value of normalizedValues) {
            const cacheKey = `${this.REDIS_KEY_PREFIX}${identityType}:${value}`;
            const cached = await this.redisService.get(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    result.set(value, parsed.user_id);
                } catch (error) {
                    uncachedValues.push(value);
                }
            } else {
                uncachedValues.push(value);
            }
        }

        if (uncachedValues.length === 0) return result;

        // Query uncached values from database
        try {
            const identities = await this.db.select()
                .from(schema.user_identities)
                .where(and(
                    eq(schema.user_identities.identity_type, identityType),
                    // Note: For large batches, consider using IN operator
                ));

            for (const identity of identities) {
                if (uncachedValues.includes(identity.identity_value)) {
                    result.set(identity.identity_value, identity.user_id);

                    // Cache the result
                    const cacheKey = `${this.REDIS_KEY_PREFIX}${identityType}:${identity.identity_value}`;
                    await this.redisService.set(
                        cacheKey,
                        JSON.stringify({
                            user_id: identity.user_id,
                            identity_type: identity.identity_type,
                            identity_value: identity.identity_value,
                        }),
                        this.REDIS_EXPIRE_SECONDS,
                    );
                }
            }
        } catch (error) {
            this.logger.error(`Failed to batch resolve identities for ${identityType}`, error);
        }

        return result;
    }

    /**
     * 删除身份映射
     */
    async removeIdentity(identityType: string, identityValue: string): Promise<void> {
        const normalizedValue = identityValue.trim().toLowerCase();

        try {
            // Get user_id before deleting for cache invalidation
            const identities = await this.db.select()
                .from(schema.user_identities)
                .where(and(
                    eq(schema.user_identities.identity_type, identityType),
                    eq(schema.user_identities.identity_value, normalizedValue),
                ))
                .limit(1);

            if (identities.length > 0) {
                const userId = identities[0].user_id;

                await this.db.delete(schema.user_identities)
                    .where(and(
                        eq(schema.user_identities.identity_type, identityType),
                        eq(schema.user_identities.identity_value, normalizedValue),
                    ));

                // Invalidate caches
                const cacheKey = `${this.REDIS_KEY_PREFIX}${identityType}:${normalizedValue}`;
                await this.redisService.client.del(cacheKey);
                await this.invalidateUserIdentitiesCache(userId);
            }
        } catch (error) {
            this.logger.error(`Failed to remove identity ${identityType}:${normalizedValue}`, error);
            throw error;
        }
    }

    /**
     * Generate a unique user ID
     */
    private generateUserId(): string {
        // Generate UUID-like user ID
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 15);
        return `u_${timestamp}_${random}`;
    }

    /**
     * Invalidate user identities list cache
     */
    private async invalidateUserIdentitiesCache(userId: string): Promise<void> {
        const cacheKey = `${this.REDIS_USER_IDENTITIES_PREFIX}${userId}`;
        await this.redisService.client.del(cacheKey);
    }
}
