import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service';
import { randomUUID } from 'crypto';

/**
 * 支持的身份ID类型
 */
export enum IdentityType {
    DEVICE_ID = 'device_id',
    IDFA = 'idfa',
    GAID = 'gaid',
    OAID = 'oaid',
    EMAIL_HASH = 'email_hash',
    PHONE_HASH = 'phone_hash',
    CUSTOM = 'custom',
}

/**
 * 用户画像数据结构
 */
export interface UserProfile {
    age?: number;
    gender?: string;
    interests?: string[];
    tags?: string[];
    custom?: Record<string, any>;
    [key: string]: any;
}

/**
 * 身份解析结果
 */
export interface IdentityResolveResult {
    internal_uid: string;
    is_new: boolean;
}

/**
 * Redis Key 前缀常量
 */
const KEY_PREFIX = {
    ALIAS: 'alias:',           // 身份映射 alias:{type}:{value} -> internal_uid
    USER_PROFILE: 'u:p:',      // 用户画像 u:p:{uid} -> Hash
    USER_SEGMENTS: 'u:s:',     // 用户人群包 u:s:{uid} -> Set
    SEGMENT_USERS: 's:u:',     // 人群包用户 s:u:{segment_id} -> Set
};

/**
 * 默认TTL配置（秒）
 */
const DEFAULT_TTL = {
    IDENTITY: 30 * 24 * 60 * 60,    // 30天
    PROFILE: 30 * 24 * 60 * 60,     // 30天
    SEGMENTS: 30 * 24 * 60 * 60,    // 30天
};

@Injectable()
export class RedisUserService {
    private readonly logger = new Logger(RedisUserService.name);

    constructor(private readonly redisService: RedisService) {}

    // ==================== 身份解析层 ====================

    /**
     * 解析身份ID，获取内部UID
     * 如果不存在则创建新用户
     */
    async resolveIdentity(
        idType: string,
        idValue: string,
        createIfNotExists: boolean = true,
    ): Promise<IdentityResolveResult> {
        const aliasKey = `${KEY_PREFIX.ALIAS}${idType}:${idValue}`;

        // 查找现有映射
        const existingUid = await this.redisService.get(aliasKey);
        if (existingUid) {
            // 刷新TTL
            await this.refreshTTL(existingUid);
            return { internal_uid: existingUid, is_new: false };
        }

        // 不存在且不创建新用户
        if (!createIfNotExists) {
            return { internal_uid: '', is_new: false };
        }

        // 创建新用户
        const internalUid = this.generateInternalUid();
        await this.linkIdentity(internalUid, idType, idValue);

        // 初始化空画像
        await this.initProfile(internalUid);

        this.logger.debug(`Created new user: ${internalUid} for ${idType}:${idValue}`);
        return { internal_uid: internalUid, is_new: true };
    }

    /**
     * 为用户绑定额外的身份ID
     */
    async linkIdentity(
        internalUid: string,
        idType: string,
        idValue: string,
    ): Promise<void> {
        const aliasKey = `${KEY_PREFIX.ALIAS}${idType}:${idValue}`;
        await this.redisService.set(aliasKey, internalUid, DEFAULT_TTL.IDENTITY);
        this.logger.debug(`Linked identity ${idType}:${idValue} -> ${internalUid}`);
    }

    /**
     * 批量绑定身份ID
     */
    async linkIdentities(
        internalUid: string,
        identities: Array<{ type: string; value: string }>,
    ): Promise<void> {
        const pipeline = this.redisService.pipeline();

        for (const identity of identities) {
            const aliasKey = `${KEY_PREFIX.ALIAS}${identity.type}:${identity.value}`;
            pipeline.set(aliasKey, internalUid, 'EX', DEFAULT_TTL.IDENTITY);
        }

        await pipeline.exec();
    }

    /**
     * 获取用户的所有身份映射（反向查询需要额外存储，暂不实现）
     */
    private generateInternalUid(): string {
        return `iu_${randomUUID().replace(/-/g, '').substring(0, 24)}`;
    }

    // ==================== 用户画像层 ====================

    /**
     * 初始化空画像
     */
    private async initProfile(internalUid: string): Promise<void> {
        const profileKey = `${KEY_PREFIX.USER_PROFILE}${internalUid}`;
        const initialData: Record<string, string> = {
            created_at: Date.now().toString(),
        };
        await this.redisService.hsetmulti(profileKey, initialData, DEFAULT_TTL.PROFILE);
    }

    /**
     * 获取用户画像
     */
    async getProfile(internalUid: string): Promise<UserProfile | null> {
        const profileKey = `${KEY_PREFIX.USER_PROFILE}${internalUid}`;
        const data = await this.redisService.hgetall(profileKey);

        if (!data || Object.keys(data).length === 0) {
            return null;
        }

        return this.parseProfile(data);
    }

    /**
     * 获取用户画像的特定字段
     */
    async getProfileField(internalUid: string, field: string): Promise<string | null> {
        const profileKey = `${KEY_PREFIX.USER_PROFILE}${internalUid}`;
        return this.redisService.hget(profileKey, field);
    }

    /**
     * 批量获取画像字段
     */
    async getProfileFields(
        internalUid: string,
        fields: string[],
    ): Promise<Record<string, string | null>> {
        const profileKey = `${KEY_PREFIX.USER_PROFILE}${internalUid}`;
        const values = await this.redisService.hmget(profileKey, ...fields);

        const result: Record<string, string | null> = {};
        fields.forEach((field, index) => {
            result[field] = values[index];
        });
        return result;
    }

    /**
     * 更新用户画像（部分更新）
     */
    async updateProfile(
        internalUid: string,
        data: Partial<UserProfile>,
    ): Promise<void> {
        const profileKey = `${KEY_PREFIX.USER_PROFILE}${internalUid}`;
        const fieldValues: Record<string, string> = {};

        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && value !== null) {
                fieldValues[key] = this.stringifyValue(value);
            }
        }

        if (Object.keys(fieldValues).length > 0) {
            fieldValues['updated_at'] = Date.now().toString();
            await this.redisService.hsetmulti(profileKey, fieldValues, DEFAULT_TTL.PROFILE);
        }
    }

    /**
     * 更新画像单个字段
     */
    async updateProfileField(
        internalUid: string,
        field: string,
        value: any,
    ): Promise<void> {
        const profileKey = `${KEY_PREFIX.USER_PROFILE}${internalUid}`;
        await this.redisService.hset(profileKey, field, this.stringifyValue(value), DEFAULT_TTL.PROFILE);
        await this.redisService.hset(profileKey, 'updated_at', Date.now().toString());
    }

    /**
     * 删除画像字段
     */
    async deleteProfileField(internalUid: string, field: string): Promise<void> {
        const profileKey = `${KEY_PREFIX.USER_PROFILE}${internalUid}`;
        await this.redisService.hdel(profileKey, field);
    }

    /**
     * 解析画像数据
     */
    private parseProfile(data: Record<string, string>): UserProfile {
        const profile: UserProfile = {};

        for (const [key, value] of Object.entries(data)) {
            if (key === 'created_at' || key === 'updated_at') {
                continue;
            }
            profile[key] = this.parseValue(value);
        }

        return profile;
    }

    /**
     * 序列化值
     */
    private stringifyValue(value: any): string {
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    }

    /**
     * 解析值
     */
    private parseValue(value: string): any {
        // 尝试解析JSON
        if (value.startsWith('[') || value.startsWith('{')) {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }

        // 尝试解析数字
        const num = Number(value);
        if (!isNaN(num)) {
            return num;
        }

        // 布尔值
        if (value === 'true') return true;
        if (value === 'false') return false;

        return value;
    }

    // ==================== 人群包层 ====================

    /**
     * 获取用户所属的所有人群包ID
     */
    async getSegmentIds(internalUid: string): Promise<number[]> {
        const segmentsKey = `${KEY_PREFIX.USER_SEGMENTS}${internalUid}`;
        const members = await this.redisService.smembers(segmentsKey);
        return members.map((m: string) => parseInt(m, 10)).filter((n: number) => !isNaN(n));
    }

    /**
     * 检查用户是否在指定人群包中
     */
    async isInSegment(internalUid: string, segmentId: number): Promise<boolean> {
        const segmentsKey = `${KEY_PREFIX.USER_SEGMENTS}${internalUid}`;
        return this.redisService.sismember(segmentsKey, segmentId.toString());
    }

    /**
     * 添加用户到人群包
     */
    async addToSegment(
        internalUid: string,
        segmentId: number,
        ttlSeconds?: number,
    ): Promise<void> {
        const segmentsKey = `${KEY_PREFIX.USER_SEGMENTS}${internalUid}`;
        const segmentUsersKey = `${KEY_PREFIX.SEGMENT_USERS}${segmentId}`;

        const ttl = ttlSeconds || DEFAULT_TTL.SEGMENTS;

        // 双向索引
        await Promise.all([
            this.redisService.saddWithTTL(segmentsKey, ttl, segmentId.toString()),
            this.redisService.sadd(segmentUsersKey, internalUid),
        ]);
    }

    /**
     * 从人群包移除用户
     */
    async removeFromSegment(internalUid: string, segmentId: number): Promise<void> {
        const segmentsKey = `${KEY_PREFIX.USER_SEGMENTS}${internalUid}`;
        const segmentUsersKey = `${KEY_PREFIX.SEGMENT_USERS}${segmentId}`;

        await Promise.all([
            this.redisService.srem(segmentsKey, segmentId.toString()),
            this.redisService.srem(segmentUsersKey, internalUid),
        ]);
    }

    /**
     * 批量添加用户到人群包
     */
    async addUsersToSegment(
        internalUids: string[],
        segmentId: number,
        ttlSeconds?: number,
    ): Promise<number> {
        if (internalUids.length === 0) return 0;

        const ttl = ttlSeconds || DEFAULT_TTL.SEGMENTS;
        const segmentIdStr = segmentId.toString();
        const segmentUsersKey = `${KEY_PREFIX.SEGMENT_USERS}${segmentId}`;

        const pipeline = this.redisService.pipeline();
        let addedCount = 0;

        for (const uid of internalUids) {
            const segmentsKey = `${KEY_PREFIX.USER_SEGMENTS}${uid}`;
            pipeline.sadd(segmentsKey, segmentIdStr);
            pipeline.expire(segmentsKey, ttl);
            pipeline.sadd(segmentUsersKey, uid);
            addedCount++;
        }

        await pipeline.exec();
        return addedCount;
    }

    /**
     * 获取人群包中的所有用户ID
     */
    async getSegmentUsers(segmentId: number): Promise<string[]> {
        const segmentUsersKey = `${KEY_PREFIX.SEGMENT_USERS}${segmentId}`;
        return this.redisService.smembers(segmentUsersKey);
    }

    /**
     * 获取人群包用户数量
     */
    async getSegmentUserCount(segmentId: number): Promise<number> {
        const segmentUsersKey = `${KEY_PREFIX.SEGMENT_USERS}${segmentId}`;
        return this.redisService.scard(segmentUsersKey);
    }

    // ==================== TTL 管理 ====================

    /**
     * 刷新用户所有数据的TTL
     */
    async refreshTTL(internalUid: string): Promise<void> {
        const profileKey = `${KEY_PREFIX.USER_PROFILE}${internalUid}`;
        const segmentsKey = `${KEY_PREFIX.USER_SEGMENTS}${internalUid}`;

        await Promise.all([
            this.redisService.expire(profileKey, DEFAULT_TTL.PROFILE),
            this.redisService.expire(segmentsKey, DEFAULT_TTL.SEGMENTS).catch(() => {}),
        ]);
    }

    /**
     * 批量刷新TTL
     */
    async refreshTTLBatch(internalUids: string[]): Promise<void> {
        const pipeline = this.redisService.pipeline();

        for (const uid of internalUids) {
            const profileKey = `${KEY_PREFIX.USER_PROFILE}${uid}`;
            const segmentsKey = `${KEY_PREFIX.USER_SEGMENTS}${uid}`;
            pipeline.expire(profileKey, DEFAULT_TTL.PROFILE);
            pipeline.expire(segmentsKey, DEFAULT_TTL.SEGMENTS);
        }

        await pipeline.exec();
    }

    // ==================== 批量操作 ====================

    /**
     * 并行获取用户画像和人群包（竞价场景优化）
     */
    async getUserData(internalUid: string): Promise<{
        profile: UserProfile | null;
        segmentIds: number[];
    }> {
        const profileKey = `${KEY_PREFIX.USER_PROFILE}${internalUid}`;
        const segmentsKey = `${KEY_PREFIX.USER_SEGMENTS}${internalUid}`;

        const [profileData, segmentMembers] = await Promise.all([
            this.redisService.hgetall(profileKey),
            this.redisService.smembers(segmentsKey),
        ]);

        return {
            profile: Object.keys(profileData).length > 0 ? this.parseProfile(profileData) : null,
            segmentIds: segmentMembers.map((m: string) => parseInt(m, 10)).filter((n: number) => !isNaN(n)),
        };
    }

    /**
     * 通过身份ID获取用户数据（一站式查询）
     */
    async getUserDataByIdentity(
        idType: string,
        idValue: string,
        createIfNotExists: boolean = true,
    ): Promise<{
        internal_uid: string;
        is_new: boolean;
        profile: UserProfile | null;
        segmentIds: number[];
    }> {
        const resolveResult = await this.resolveIdentity(idType, idValue, createIfNotExists);

        if (!resolveResult.internal_uid) {
            return {
                ...resolveResult,
                profile: null,
                segmentIds: [],
            };
        }

        const userData = await this.getUserData(resolveResult.internal_uid);

        return {
            ...resolveResult,
            ...userData,
        };
    }

    // ==================== 删除操作 ====================

    /**
     * 删除用户所有数据
     */
    async deleteUser(internalUid: string): Promise<void> {
        // 获取用户所属人群包
        const segmentIds = await this.getSegmentIds(internalUid);

        const pipeline = this.redisService.pipeline();

        // 删除画像
        pipeline.del(`${KEY_PREFIX.USER_PROFILE}${internalUid}`);
        // 删除人群包关系
        pipeline.del(`${KEY_PREFIX.USER_SEGMENTS}${internalUid}`);

        // 从人群包用户集合中移除
        for (const segmentId of segmentIds) {
            pipeline.srem(`${KEY_PREFIX.SEGMENT_USERS}${segmentId}`, internalUid);
        }

        await pipeline.exec();
    }
}
