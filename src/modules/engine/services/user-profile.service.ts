import { Injectable, Logger, Inject } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service';
import { DRIZZLE } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq } from 'drizzle-orm';

/**
 * User profile interface
 */
export interface UserProfile {
    user_id: string;
    age?: number;
    gender?: 'male' | 'female' | 'other' | 'unknown';
    interests: string[];
    tags: string[];
    custom_attributes?: Record<string, any>;
    updated_at: Date;
}

@Injectable()
export class UserProfileService {
    private readonly logger = new Logger(UserProfileService.name);
    private readonly REDIS_KEY_PREFIX = 'user:profile:';
    private readonly REDIS_EXPIRE_SECONDS = 7 * 24 * 60 * 60; // 7 days

    constructor(
        private readonly redisService: RedisService,
        @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    ) { }

    /**
     * Get user profile by user_id
     * First check Redis cache, then fallback to PostgreSQL, then cache the result
     */
    async getProfile(userId: string): Promise<Partial<UserProfile> | null> {
        if (!userId) return null;

        // Try to get from Redis first
        const cacheKey = `${this.REDIS_KEY_PREFIX}${userId}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (error) {
                this.logger.warn(`Failed to parse cached profile for user ${userId}`, error);
            }
        }

        // Fallback to PostgreSQL
        try {
            const profiles = await this.db.select()
                .from(schema.user_profiles)
                .where(eq(schema.user_profiles.user_id, userId))
                .limit(1);
            const profile = profiles[0] || null;

            if (profile) {
                const result: UserProfile = {
                    user_id: profile.user_id,
                    age: profile.age || undefined,
                    gender: profile.gender as any || 'unknown',
                    interests: Array.isArray(profile.interests) ? profile.interests : [],
                    tags: Array.isArray(profile.tags) ? profile.tags : [],
                    custom_attributes: profile.custom_attributes as any || {},
                    updated_at: profile.updated_at,
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
            // If table doesn't exist yet, return null gracefully
            if (error.message?.includes('relation "user_profiles" does not exist')) {
                this.logger.debug('user_profiles table not found, returning null profile');
                return null;
            }
            this.logger.error(`Failed to get profile for user ${userId}`, error);
        }

        return null;
    }

    /**
     * Update user profile
     * Update both PostgreSQL and Redis cache
     */
    async updateProfile(userId: string, profile: Partial<Omit<UserProfile, 'user_id' | 'updated_at'>>): Promise<void> {
        if (!userId) return;

        try {
            // Update PostgreSQL
            await this.db.insert(schema.user_profiles)
                .values({
                    user_id: userId,
                    ...profile,
                    updated_at: new Date(),
                })
                .onConflictDoUpdate({
                    target: schema.user_profiles.user_id,
                    set: {
                        ...profile,
                        updated_at: new Date(),
                    },
                });

            // Invalidate cache
            const cacheKey = `${this.REDIS_KEY_PREFIX}${userId}`;
            await this.redisService.client.del(cacheKey);

            // Refresh cache
            await this.getProfile(userId);
        } catch (error) {
            // If table doesn't exist yet, log warning
            if (error.message?.includes('relation "user_profiles" does not exist')) {
                this.logger.debug('user_profiles table not found, skipping profile update');
                return;
            }
            this.logger.error(`Failed to update profile for user ${userId}`, error);
        }
    }

    /**
     * Add interests to user profile
     */
    async addInterests(userId: string, interests: string[]): Promise<void> {
        if (!userId || !interests.length) return;

        const profile = await this.getProfile(userId) || { interests: [] };
        const newInterests = [...new Set([...(profile.interests || []), ...interests])];

        await this.updateProfile(userId, { interests: newInterests });
    }

    /**
     * Add tags to user profile
     */
    async addTags(userId: string, tags: string[]): Promise<void> {
        if (!userId || !tags.length) return;

        const profile = await this.getProfile(userId) || { tags: [] };
        const newTags = [...new Set([...(profile.tags || []), ...tags])];

        await this.updateProfile(userId, { tags: newTags });
    }
}
