import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyService } from '../../../src/modules/api-key/api-key.service';
import { NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';

describe('ApiKeyService', () => {
    let service: ApiKeyService;
    let mockDb: any;

    beforeEach(async () => {
        mockDb = {
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            values: jest.fn().mockReturnThis(),
            returning: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ApiKeyService,
                {
                    provide: 'DRIZZLE_CONNECTION',
                    useValue: mockDb,
                },
            ],
        }).compile();

        service = module.get<ApiKeyService>(ApiKeyService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createApiKey', () => {
        it('should create an API key and return it with plain key', async () => {
            const mockResult = {
                id: 1,
                name: 'Test Key',
                key_prefix: 'oas_abcdefghij',
                permissions: ['read', 'write'],
                expires_at: null,
                status: 1,
                created_at: new Date(),
            };

            mockDb.returning.mockResolvedValueOnce([mockResult]);

            const result = await service.createApiKey(1, {
                name: 'Test Key',
                permissions: ['read', 'write'],
            });

            expect(result.name).toBe('Test Key');
            expect(result.plain_key).toBeDefined();
            expect(result.plain_key).toMatch(/^oas_/);
        });
    });

    describe('getApiKeysByUser', () => {
        it('should return all API keys for a user', async () => {
            const mockKeys = [
                { id: 1, name: 'Key 1', key_prefix: 'oas_abc', permissions: [], status: 1 },
                { id: 2, name: 'Key 2', key_prefix: 'oas_def', permissions: [], status: 1 },
            ];

            mockDb.orderBy.mockResolvedValueOnce(mockKeys);

            const result = await service.getApiKeysByUser(1);

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Key 1');
        });
    });

    describe('getApiKeyById', () => {
        it('should return API key by id', async () => {
            const mockKey = {
                id: 1,
                name: 'Test Key',
                key_prefix: 'oas_abc',
                permissions: [],
                status: 1,
            };

            mockDb.limit.mockResolvedValueOnce([mockKey]);

            const result = await service.getApiKeyById(1, 1);

            expect(result.name).toBe('Test Key');
        });

        it('should throw NotFoundException for non-existent key', async () => {
            mockDb.limit.mockResolvedValueOnce([]);

            await expect(service.getApiKeyById(999, 1)).rejects.toThrow(NotFoundException);
        });
    });

    describe('revokeApiKey', () => {
        it('should revoke an API key', async () => {
            const mockKey = {
                id: 1,
                name: 'Test Key',
                key_prefix: 'oas_abc',
                permissions: [],
                status: 1,
            };

            mockDb.limit.mockResolvedValueOnce([mockKey]);
            mockDb.where.mockReturnThis();

            const result = await service.revokeApiKey(1, 1);

            expect(result.message).toBe('API key revoked successfully');
        });
    });

    describe('deleteApiKey', () => {
        it('should delete an API key', async () => {
            const mockKey = {
                id: 1,
                name: 'Test Key',
                key_prefix: 'oas_abc',
                permissions: [],
                status: 1,
            };

            mockDb.limit.mockResolvedValueOnce([mockKey]);
            mockDb.where.mockReturnThis();

            const result = await service.deleteApiKey(1, 1);

            expect(result.message).toBe('API key deleted successfully');
        });
    });

    describe('validateApiKey', () => {
        it('should validate an active API key', async () => {
            const plainKey = 'oas_testkey12345678901234567890';
            const keyHash = createHash('sha256').update(plainKey).digest('hex');

            const mockKey = {
                id: 1,
                user_id: 1,
                permissions: ['read'],
                status: 1,
                expires_at: null,
            };

            mockDb.limit.mockResolvedValueOnce([mockKey]);
            mockDb.where.mockReturnThis();

            const result = await service.validateApiKey(plainKey);

            expect(result).not.toBeNull();
            expect(result?.userId).toBe(1);
            expect(result?.permissions).toContain('read');
        });

        it('should return null for invalid key', async () => {
            mockDb.limit.mockResolvedValueOnce([]);

            const result = await service.validateApiKey('invalid_key');

            expect(result).toBeNull();
        });

        it('should return null for revoked key', async () => {
            const mockKey = {
                id: 1,
                user_id: 1,
                permissions: [],
                status: 0, // Revoked
                expires_at: null,
            };

            mockDb.limit.mockResolvedValueOnce([mockKey]);

            const result = await service.validateApiKey('oas_testkey');

            expect(result).toBeNull();
        });

        it('should return null for expired key', async () => {
            const mockKey = {
                id: 1,
                user_id: 1,
                permissions: [],
                status: 1,
                expires_at: new Date(Date.now() - 86400000), // Expired yesterday
            };

            mockDb.limit.mockResolvedValueOnce([mockKey]);

            const result = await service.validateApiKey('oas_testkey');

            expect(result).toBeNull();
        });
    });
});
