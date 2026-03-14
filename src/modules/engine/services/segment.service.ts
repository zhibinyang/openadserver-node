import { Injectable, Logger, Inject } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service';
import { DRIZZLE } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, inArray } from 'drizzle-orm';

@Injectable()
export class SegmentService {
    private readonly logger = new Logger(SegmentService.name);
    private readonly SEGMENT_CACHE_PREFIX = 'segment:';
    private readonly USER_SEGMENTS_CACHE_PREFIX = 'user:segments:';
    private readonly CACHE_TTL = 86400; // 24 hours

    constructor(
        private readonly redisService: RedisService,
        @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    ) { }

    /**
     * 创建人群包
     */
    async createSegment(data: {
        name: string;
        description?: string;
        type?: string;
    }) {
        const [segment] = await this.db.insert(schema.segments)
            .values({
                name: data.name,
                description: data.description,
                type: data.type || 'custom',
            })
            .returning();
        return segment;
    }

    /**
     * 获取人群包详情
     */
    async getSegment(segmentId: number) {
        // 先查缓存
        const cacheKey = `${this.SEGMENT_CACHE_PREFIX}${segmentId}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (error) {
                this.logger.warn(`Failed to parse cached segment ${segmentId}`, error);
            }
        }

        const segments = await this.db.select()
            .from(schema.segments)
            .where(eq(schema.segments.id, segmentId))
            .limit(1);
        const segment = segments[0] || null;

        if (segment) {
            // 写入缓存
            await this.redisService.set(cacheKey, JSON.stringify(segment), this.CACHE_TTL);
        }

        return segment;
    }

    /**
     * 批量添加用户到人群包
     */
    async addUsersToSegment(segmentId: number, userIds: string[], expiresAt?: Date) {
        if (userIds.length === 0) return 0;

        // 去重
        const uniqueUserIds = [...new Set(userIds)];

        const values = uniqueUserIds.map(userId => ({
            segment_id: segmentId,
            user_id: userId,
            expires_at: expiresAt,
        }));

        // 批量插入，冲突则忽略
        const result = await this.db.insert(schema.segment_users)
            .values(values)
            .onConflictDoNothing()
            .returning();

        // 更新人群包用户数量
        if (result.length > 0) {
            // 先获取当前用户数量
            const currentSegments = await this.db.select()
                .from(schema.segments)
                .where(eq(schema.segments.id, segmentId))
                .limit(1);
            const currentSegment = currentSegments[0];
            if (currentSegment) {
                await this.db.update(schema.segments)
                    .set({
                        user_count: (currentSegment.user_count || 0) + result.length,
                        updated_at: new Date(),
                    })
                    .where(eq(schema.segments.id, segmentId));
            }

            // 清除用户所属人群包缓存
            for (const userId of uniqueUserIds) {
                await this.redisService.client.del(`${this.USER_SEGMENTS_CACHE_PREFIX}${userId}`);
            }

            // 清除人群包缓存
            await this.redisService.client.del(`${this.SEGMENT_CACHE_PREFIX}${segmentId}`);
        }

        return result.length;
    }

    /**
     * 获取用户所属的所有人群组ID
     */
    async getUserSegmentIds(userId: string): Promise<number[]> {
        if (!userId) return [];

        // 先查缓存
        const cacheKey = `${this.USER_SEGMENTS_CACHE_PREFIX}${userId}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (error) {
                this.logger.warn(`Failed to parse cached user segments for user ${userId}`, error);
            }
        }

        // 查询数据库
        const userSegments = await this.db.select()
            .from(schema.segment_users)
            .where(eq(schema.segment_users.user_id, userId));

        const segmentIds = userSegments.map(s => s.segment_id);

        // 写入缓存
        await this.redisService.set(cacheKey, JSON.stringify(segmentIds), this.CACHE_TTL);

        return segmentIds;
    }

    /**
     * 检查用户是否属于指定人群包
     */
    async isUserInSegment(userId: string, segmentId: number): Promise<boolean> {
        const userSegments = await this.getUserSegmentIds(userId);
        return userSegments.includes(segmentId);
    }

    /**
     * 删除人群包
     */
    async deleteSegment(segmentId: number) {
        // 删除人群包
        await this.db.delete(schema.segments)
            .where(eq(schema.segments.id, segmentId));

        // 清除缓存
        await this.redisService.client.del(`${this.SEGMENT_CACHE_PREFIX}${segmentId}`);

        return true;
    }
}
