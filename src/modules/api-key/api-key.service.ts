import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { ApiKeyStatus } from '../../database/schema';

export interface ApiKeyWithPlainKey {
    id: number;
    name: string;
    key_prefix: string;
    permissions: string[];
    expires_at: Date | null;
    status: number | null;
    created_at: Date;
    plain_key?: string; // Only returned on creation
}

@Injectable()
export class ApiKeyService {
    constructor(
        @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
    ) { }

    /**
     * Generate a new API key with format: oas_<random_32_chars}
     */
    private generateApiKey(): { plainKey: string; keyHash: string; keyPrefix: string } {
        const randomString = randomBytes(24).toString('base64url');
        const plainKey = `oas_${randomString}`;
        const keyPrefix = plainKey.substring(0, 12);
        const keyHash = createHash('sha256').update(plainKey).digest('hex');

        return { plainKey, keyHash, keyPrefix };
    }

    async createApiKey(userId: number, createDto: CreateApiKeyDto): Promise<ApiKeyWithPlainKey> {
        const { plainKey, keyHash, keyPrefix } = this.generateApiKey();

        const result = await this.db.insert(schema.api_keys)
            .values({
                user_id: userId,
                name: createDto.name,
                key_hash: keyHash,
                key_prefix: keyPrefix,
                permissions: createDto.permissions || [],
                expires_at: createDto.expires_at ? new Date(createDto.expires_at) : null,
                status: ApiKeyStatus.ACTIVE,
            })
            .returning({
                id: schema.api_keys.id,
                name: schema.api_keys.name,
                key_prefix: schema.api_keys.key_prefix,
                permissions: schema.api_keys.permissions,
                expires_at: schema.api_keys.expires_at,
                status: schema.api_keys.status,
                created_at: schema.api_keys.created_at,
            });

        return {
            ...result[0],
            permissions: (result[0].permissions as string[]) || [],
            plain_key: plainKey, // Return plain key only on creation
        };
    }

    async getApiKeysByUser(userId: number): Promise<ApiKeyWithPlainKey[]> {
        const results = await this.db.select({
            id: schema.api_keys.id,
            name: schema.api_keys.name,
            key_prefix: schema.api_keys.key_prefix,
            permissions: schema.api_keys.permissions,
            expires_at: schema.api_keys.expires_at,
            status: schema.api_keys.status,
            created_at: schema.api_keys.created_at,
        })
            .from(schema.api_keys)
            .where(eq(schema.api_keys.user_id, userId))
            .orderBy(schema.api_keys.created_at);

        return results.map(r => ({
            ...r,
            permissions: (r.permissions as string[]) || [],
        }));
    }

    async getApiKeyById(id: number, userId: number): Promise<ApiKeyWithPlainKey> {
        const keys = await this.db.select({
            id: schema.api_keys.id,
            name: schema.api_keys.name,
            key_prefix: schema.api_keys.key_prefix,
            permissions: schema.api_keys.permissions,
            expires_at: schema.api_keys.expires_at,
            status: schema.api_keys.status,
            created_at: schema.api_keys.created_at,
        })
            .from(schema.api_keys)
            .where(and(
                eq(schema.api_keys.id, id),
                eq(schema.api_keys.user_id, userId)
            ))
            .limit(1);

        if (keys.length === 0) {
            throw new NotFoundException('API key not found');
        }

        return {
            ...keys[0],
            permissions: (keys[0].permissions as string[]) || [],
        };
    }

    async updateApiKey(id: number, userId: number, updateDto: UpdateApiKeyDto): Promise<ApiKeyWithPlainKey> {
        // Verify ownership
        await this.getApiKeyById(id, userId);

        const updateData: any = { ...updateDto, updated_at: new Date() };
        if (updateDto.expires_at !== undefined) {
            updateData.expires_at = updateDto.expires_at ? new Date(updateDto.expires_at) : null;
        }
        delete updateData.id;

        const result = await this.db.update(schema.api_keys)
            .set(updateData)
            .where(and(
                eq(schema.api_keys.id, id),
                eq(schema.api_keys.user_id, userId)
            ))
            .returning({
                id: schema.api_keys.id,
                name: schema.api_keys.name,
                key_prefix: schema.api_keys.key_prefix,
                permissions: schema.api_keys.permissions,
                expires_at: schema.api_keys.expires_at,
                status: schema.api_keys.status,
                created_at: schema.api_keys.created_at,
            });

        return {
            ...result[0],
            permissions: (result[0].permissions as string[]) || [],
        };
    }

    async revokeApiKey(id: number, userId: number): Promise<{ message: string }> {
        // Verify ownership
        await this.getApiKeyById(id, userId);

        await this.db.update(schema.api_keys)
            .set({ status: ApiKeyStatus.REVOKED, updated_at: new Date() })
            .where(and(
                eq(schema.api_keys.id, id),
                eq(schema.api_keys.user_id, userId)
            ));

        return { message: 'API key revoked successfully' };
    }

    async deleteApiKey(id: number, userId: number): Promise<{ message: string }> {
        // Verify ownership
        await this.getApiKeyById(id, userId);

        await this.db.delete(schema.api_keys)
            .where(and(
                eq(schema.api_keys.id, id),
                eq(schema.api_keys.user_id, userId)
            ));

        return { message: 'API key deleted successfully' };
    }

    /**
     * Validate an API key by its plain text value
     * Used for API authentication
     */
    async validateApiKey(plainKey: string): Promise<{ userId: number; permissions: string[] } | null> {
        const keyHash = createHash('sha256').update(plainKey).digest('hex');

        const keys = await this.db.select({
            id: schema.api_keys.id,
            user_id: schema.api_keys.user_id,
            permissions: schema.api_keys.permissions,
            status: schema.api_keys.status,
            expires_at: schema.api_keys.expires_at,
        })
            .from(schema.api_keys)
            .where(eq(schema.api_keys.key_hash, keyHash))
            .limit(1);

        const key = keys[0];
        if (!key) {
            return null;
        }

        // Check if key is active
        if (key.status !== ApiKeyStatus.ACTIVE) {
            return null;
        }

        // Check if key is expired
        if (key.expires_at && new Date() > key.expires_at) {
            return null;
        }

        // Update last used timestamp
        await this.db.update(schema.api_keys)
            .set({ last_used_at: new Date() })
            .where(eq(schema.api_keys.id, key.id));

        return {
            userId: key.user_id,
            permissions: (key.permissions as string[]) || [],
        };
    }

    /**
     * Admin: Get all API keys (for admin panel)
     */
    async getAllApiKeys(): Promise<any[]> {
        return this.db.select({
            id: schema.api_keys.id,
            name: schema.api_keys.name,
            key_prefix: schema.api_keys.key_prefix,
            permissions: schema.api_keys.permissions,
            status: schema.api_keys.status,
            expires_at: schema.api_keys.expires_at,
            last_used_at: schema.api_keys.last_used_at,
            created_at: schema.api_keys.created_at,
            user_id: schema.api_keys.user_id,
        })
            .from(schema.api_keys)
            .orderBy(schema.api_keys.created_at);
    }
}
