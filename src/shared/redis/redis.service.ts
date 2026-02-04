
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

    async hmget(key: string, ...fields: string[]): Promise<(string | null)[]> {
        return this.redis.hmget(key, ...fields);
    }
}
