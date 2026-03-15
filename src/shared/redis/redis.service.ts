
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private redis: Redis;
    private readonly logger = new Logger(RedisService.name);

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        const host = this.configService.get<string>('REDIS_HOST', 'localhost');
        const port = this.configService.get<number>('REDIS_PORT', 6379);

        this.logger.log(`Connecting to Redis at ${host}:${port}`);
        this.redis = new Redis({
            host,
            port,
            lazyConnect: true,
        });

        // Connect explicitly to handle errors on startup if needed
        this.redis.connect().catch((error) => {
            this.logger.error('Failed to connect to Redis', error);
        });
    }

    onModuleDestroy() {
        this.redis.disconnect();
    }

    get client(): Redis {
        return this.redis;
    }

    // --- Utility Methods ---

    async get(key: string): Promise<string | null> {
        return this.redis.get(key);
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds) {
            await this.redis.set(key, value, 'EX', ttlSeconds);
        } else {
            await this.redis.set(key, value);
        }
    }

    async expire(key: string, seconds: number): Promise<void> {
        await this.redis.expire(key, seconds);
    }

    async incr(key: string, ttlSeconds?: number): Promise<number> {
        const pipeline = this.redis.pipeline();
        pipeline.incr(key);
        if (ttlSeconds) {
            pipeline.expire(key, ttlSeconds);
        }
        const results = await pipeline.exec();
        // results[0] is for incr: [error, newValue]
        if (results && results[0] && !results[0][0]) {
            return results[0][1] as number;
        }
        throw new Error(`Failed to incr key ${key}`);
    }

    async hincrbyfloat(key: string, field: string, increment: number): Promise<number> {
        const res = await this.redis.hincrbyfloat(key, field, increment);
        return parseFloat(res); // API returns string
    }

    async hincrby(key: string, field: string, increment: number): Promise<number> {
        return this.redis.hincrby(key, field, increment);
    }

    async hmget(key: string, ...fields: string[]): Promise<(string | null)[]> {
        return this.redis.hmget(key, ...fields);
    }

    // --- Hash Operations ---

    async hset(key: string, field: string, value: string, ttlSeconds?: number): Promise<void> {
        await this.redis.hset(key, field, value);
        if (ttlSeconds) {
            await this.redis.expire(key, ttlSeconds);
        }
    }

    async hsetmulti(key: string, fieldValueMap: Record<string, string>, ttlSeconds?: number): Promise<void> {
        if (Object.keys(fieldValueMap).length === 0) return;
        await this.redis.hset(key, fieldValueMap);
        if (ttlSeconds) {
            await this.redis.expire(key, ttlSeconds);
        }
    }

    async hget(key: string, field: string): Promise<string | null> {
        return this.redis.hget(key, field);
    }

    async hgetall(key: string): Promise<Record<string, string>> {
        return this.redis.hgetall(key);
    }

    async hdel(key: string, ...fields: string[]): Promise<number> {
        return this.redis.hdel(key, ...fields);
    }

    async hexists(key: string, field: string): Promise<boolean> {
        return this.redis.hexists(key, field);
    }

    // --- Set Operations ---

    async sadd(key: string, ...members: string[]): Promise<number> {
        return this.redis.sadd(key, ...members);
    }

    async saddWithTTL(key: string, ttlSeconds: number, ...members: string[]): Promise<number> {
        const result = await this.redis.sadd(key, ...members);
        await this.redis.expire(key, ttlSeconds);
        return result;
    }

    async srem(key: string, ...members: string[]): Promise<number> {
        return this.redis.srem(key, ...members);
    }

    async sismember(key: string, member: string): Promise<boolean> {
        return this.redis.sismember(key, member);
    }

    async smembers(key: string): Promise<string[]> {
        return this.redis.smembers(key);
    }

    async scard(key: string): Promise<number> {
        return this.redis.scard(key);
    }

    // --- Key Operations ---

    async del(key: string): Promise<number> {
        return this.redis.del(key);
    }

    async exists(key: string): Promise<boolean> {
        return this.redis.exists(key).then(n => n === 1);
    }

    async ttl(key: string): Promise<number> {
        return this.redis.ttl(key);
    }

    // --- Pipeline Support ---

    pipeline() {
        return this.redis.pipeline();
    }

    // --- Multi/Transaction Support ---

    multi() {
        return this.redis.multi();
    }
}
