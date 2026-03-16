import { Injectable, Logger, Inject } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service';
import { DRIZZLE } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, inArray } from 'drizzle-orm';
import { RedisUserService, IdentityType } from './redis-user.service';

/**
 * 身份项接口
 */
export interface IdentityItem {
    identity_type: string;
    identity_value: string;
}

/**
 * 人群包创建参数
 */
export interface CreateSegmentDto {
    name: string;
    description?: string;
    type?: string;
    ttl_days?: number;
}

/**
 * 人群包元数据
 */
export interface SegmentMetadata {
    id: number;
    name: string;
    description: string | null;
    type: string;
    status: number | null;
    user_count: number | null;
    ttl_days: number;
    created_at: Date;
    updated_at: Date;
}

/**
 * Redis Key 前缀
 */
const KEY_PREFIX = {
    SEGMENT_META: 'seg:m:',      // 人群包元数据缓存
    SEGMENT_USERS: 's:u:',       // 人群包用户集合
};

/**
 * 默认TTL配置
 */
const DEFAULT_TTL = {
    META_CACHE: 24 * 60 * 60,    // 元数据缓存 24小时
    SEGMENT_USERS: 30 * 24 * 60 * 60, // 人群包用户 30天
};

@Injectable()
export class RedisSegmentService {
    private readonly logger = new Logger(RedisSegmentService.name);

    constructor(
        private readonly redisService: RedisService,
        private readonly redisUserService: RedisUserService,
        @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    ) {}

    // ==================== 人群包元数据管理 ====================

    /**
     * 创建人群包
     */
    async createSegment(data: CreateSegmentDto): Promise<SegmentMetadata> {
        const [segment] = await this.db.insert(schema.segments)
            .values({
                name: data.name,
                description: data.description,
                type: data.type || 'custom',
            })
            .returning();

        // 缓存元数据
        const metadata: SegmentMetadata = {
            ...segment,
            ttl_days: data.ttl_days || 30,
        };
        await this.cacheSegmentMeta(metadata);

        return metadata;
    }

    /**
     * 获取人群包元数据
     */
    async getSegment(segmentId: number): Promise<SegmentMetadata | null> {
        // 先查缓存
        const cacheKey = `${KEY_PREFIX.SEGMENT_META}${segmentId}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (error) {
                this.logger.warn(`Failed to parse cached segment ${segmentId}`);
            }
        }

        // 查数据库
        const segments = await this.db.select()
            .from(schema.segments)
            .where(eq(schema.segments.id, segmentId))
            .limit(1);

        if (segments.length === 0) {
            return null;
        }

        const segment = segments[0];
        const metadata: SegmentMetadata = {
            ...segment,
            ttl_days: 30,
        };

        await this.cacheSegmentMeta(metadata);
        return metadata;
    }

    /**
     * 更新人群包元数据
     */
    async updateSegment(
        segmentId: number,
        data: Partial<CreateSegmentDto>,
    ): Promise<SegmentMetadata | null> {
        const [updated] = await this.db.update(schema.segments)
            .set({
                ...data,
                updated_at: new Date(),
            })
            .where(eq(schema.segments.id, segmentId))
            .returning();

        if (!updated) {
            return null;
        }

        // 清除缓存
        await this.redisService.del(`${KEY_PREFIX.SEGMENT_META}${segmentId}`);

        return this.getSegment(segmentId);
    }

    /**
     * 删除人群包
     */
    async deleteSegment(segmentId: number): Promise<boolean> {
        // 获取所有用户
        const userIds = await this.redisUserService.getSegmentUsers(segmentId);

        // 从用户的人群包集合中移除
        const pipeline = this.redisService.pipeline();
        for (const uid of userIds) {
            pipeline.srem(`u:s:${uid}`, segmentId.toString());
        }
        await pipeline.exec();

        // 删除人群包用户集合
        await this.redisService.del(`${KEY_PREFIX.SEGMENT_USERS}${segmentId}`);

        // 删除元数据
        await this.db.delete(schema.segments)
            .where(eq(schema.segments.id, segmentId));

        // 清除缓存
        await this.redisService.del(`${KEY_PREFIX.SEGMENT_META}${segmentId}`);

        return true;
    }

    /**
     * 缓存人群包元数据
     */
    private async cacheSegmentMeta(metadata: SegmentMetadata): Promise<void> {
        const cacheKey = `${KEY_PREFIX.SEGMENT_META}${metadata.id}`;
        await this.redisService.set(cacheKey, JSON.stringify(metadata), DEFAULT_TTL.META_CACHE);
    }

    // ==================== 用户批量操作 ====================

    /**
     * 通过身份标识批量添加用户到人群包
     */
    async addIdentitiesToSegment(
        segmentId: number,
        identities: IdentityItem[],
        ttlSeconds?: number,
    ): Promise<{ added_count: number; internal_uids: string[] }> {
        if (identities.length === 0) {
            return { added_count: 0, internal_uids: [] };
        }

        const internalUids: string[] = [];
        const ttl = ttlSeconds || DEFAULT_TTL.SEGMENT_USERS;

        // 解析所有身份标识
        for (const identity of identities) {
            const result = await this.redisUserService.resolveIdentity(
                identity.identity_type,
                identity.identity_value,
                true,
            );
            internalUids.push(result.internal_uid);
        }

        // 批量添加到人群包
        const addedCount = await this.redisUserService.addUsersToSegment(
            internalUids,
            segmentId,
            ttl,
        );

        // 更新人群包用户数量
        await this.updateSegmentUserCount(segmentId);

        return { added_count: addedCount, internal_uids: internalUids };
    }

    /**
     * 通过统一身份类型批量添加用户到人群包
     */
    async addIdentitiesToSegmentByType(
        segmentId: number,
        identityType: string,
        identityValues: string[],
        ttlSeconds?: number,
    ): Promise<{ added_count: number; internal_uids: string[] }> {
        const identities: IdentityItem[] = identityValues.map(value => ({
            identity_type: identityType,
            identity_value: value,
        }));
        return this.addIdentitiesToSegment(segmentId, identities, ttlSeconds);
    }

    /**
     * 通过内部UID批量添加用户到人群包
     */
    async addUsersToSegment(
        segmentId: number,
        internalUids: string[],
        ttlSeconds?: number,
    ): Promise<number> {
        if (internalUids.length === 0) return 0;

        const ttl = ttlSeconds || DEFAULT_TTL.SEGMENT_USERS;
        const addedCount = await this.redisUserService.addUsersToSegment(
            internalUids,
            segmentId,
            ttl,
        );

        await this.updateSegmentUserCount(segmentId);
        return addedCount;
    }

    /**
     * 通过身份标识从人群包移除用户
     */
    async removeIdentitiesFromSegment(
        segmentId: number,
        identities: IdentityItem[],
    ): Promise<number> {
        let removedCount = 0;

        for (const identity of identities) {
            const result = await this.redisUserService.resolveIdentity(
                identity.identity_type,
                identity.identity_value,
                false,
            );

            if (result.internal_uid) {
                await this.redisUserService.removeFromSegment(result.internal_uid, segmentId);
                removedCount++;
            }
        }

        await this.updateSegmentUserCount(segmentId);
        return removedCount;
    }

    /**
     * 清空人群包所有用户
     */
    async clearSegment(segmentId: number): Promise<void> {
        const userIds = await this.redisUserService.getSegmentUsers(segmentId);

        const pipeline = this.redisService.pipeline();
        for (const uid of userIds) {
            pipeline.srem(`u:s:${uid}`, segmentId.toString());
        }
        await pipeline.exec();

        await this.redisService.del(`${KEY_PREFIX.SEGMENT_USERS}${segmentId}`);
        await this.updateSegmentUserCount(segmentId);
    }

    // ==================== 查询操作 ====================

    /**
     * 检查用户是否在人群包中（通过身份标识）
     */
    async isIdentityInSegment(
        identityType: string,
        identityValue: string,
        segmentId: number,
    ): Promise<boolean> {
        const result = await this.redisUserService.resolveIdentity(
            identityType,
            identityValue,
            false,
        );

        if (!result.internal_uid) {
            return false;
        }

        return this.redisUserService.isInSegment(result.internal_uid, segmentId);
    }

    /**
     * 获取用户所属的所有人群包ID（通过身份标识）
     */
    async getSegmentIdsByIdentity(
        identityType: string,
        identityValue: string,
    ): Promise<number[]> {
        const result = await this.redisUserService.resolveIdentity(
            identityType,
            identityValue,
            false,
        );

        if (!result.internal_uid) {
            return [];
        }

        return this.redisUserService.getSegmentIds(result.internal_uid);
    }

    /**
     * 获取人群包用户数量
     */
    async getSegmentUserCount(segmentId: number): Promise<number> {
        return this.redisUserService.getSegmentUserCount(segmentId);
    }

    /**
     * 获取人群包所有用户ID
     */
    async getSegmentUsers(segmentId: number): Promise<string[]> {
        return this.redisUserService.getSegmentUsers(segmentId);
    }

    /**
     * 更新人群包用户数量
     */
    private async updateSegmentUserCount(segmentId: number): Promise<void> {
        const count = await this.redisUserService.getSegmentUserCount(segmentId);

        await this.db.update(schema.segments)
            .set({
                user_count: count,
                updated_at: new Date(),
            })
            .where(eq(schema.segments.id, segmentId));

        // 清除元数据缓存
        await this.redisService.del(`${KEY_PREFIX.SEGMENT_META}${segmentId}`);
    }

    // ==================== 批量查询 ====================

    /**
     * 批量获取人群包元数据
     */
    async getSegments(segmentIds: number[]): Promise<SegmentMetadata[]> {
        if (segmentIds.length === 0) return [];

        const results: SegmentMetadata[] = [];
        const uncachedIds: number[] = [];

        // 先从缓存获取
        for (const id of segmentIds) {
            const cached = await this.redisService.get(`${KEY_PREFIX.SEGMENT_META}${id}`);
            if (cached) {
                try {
                    results.push(JSON.parse(cached));
                } catch {
                    uncachedIds.push(id);
                }
            } else {
                uncachedIds.push(id);
            }
        }

        // 查询未缓存的数据
        if (uncachedIds.length > 0) {
            const segments = await this.db.select()
                .from(schema.segments)
                .where(inArray(schema.segments.id, uncachedIds));

            for (const segment of segments) {
                const metadata: SegmentMetadata = {
                    ...segment,
                    ttl_days: 30,
                };
                results.push(metadata);
                await this.cacheSegmentMeta(metadata);
            }
        }

        return results;
    }

    /**
     * 获取所有活跃人群包
     */
    async getActiveSegments(): Promise<SegmentMetadata[]> {
        const segments = await this.db.select()
            .from(schema.segments)
            .where(eq(schema.segments.status, 1));

        return segments.map(s => ({
            ...s,
            ttl_days: 30,
        }));
    }
}
