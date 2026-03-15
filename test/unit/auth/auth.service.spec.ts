import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthService } from '../../../src/modules/auth/auth.service';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

// Mock bcrypt and jwt
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
    let service: AuthService;
    let mockDb: any;
    let mockConfigService: any;

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
        };

        mockConfigService = {
            get: jest.fn((key: string) => {
                if (key === 'JWT_SECRET') return 'test-secret-key';
                if (key === 'JWT_EXPIRES_IN') return '24h';
                return null;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: 'DRIZZLE_CONNECTION',
                    useValue: mockDb,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        it('should return user and token on successful login', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                email: 'test@example.com',
                password_hash: 'hashedpassword',
                role: 'admin',
                status: 1,
            };

            mockDb.limit.mockResolvedValueOnce([mockUser]);
            (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
            (jwt.sign as jest.Mock).mockReturnValueOnce('mock-token');
            mockDb.where.mockReturnThis();

            const result = await service.login({
                username: 'testuser',
                password: 'password123',
            });

            expect(result.user.username).toBe('testuser');
            expect(result.token).toBe('mock-token');
        });

        it('should throw UnauthorizedException for invalid username', async () => {
            mockDb.limit.mockResolvedValueOnce([]);

            await expect(
                service.login({ username: 'nonexistent', password: 'password123' })
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException for invalid password', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: 'hashedpassword',
                status: 1,
            };

            mockDb.limit.mockResolvedValueOnce([mockUser]);
            (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

            await expect(
                service.login({ username: 'testuser', password: 'wrongpassword' })
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException for inactive user', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: 'hashedpassword',
                status: 0, // inactive
            };

            mockDb.limit.mockResolvedValueOnce([mockUser]);

            await expect(
                service.login({ username: 'testuser', password: 'password123' })
            ).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('getCurrentUser', () => {
        it('should return user by id', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                email: 'test@example.com',
                role: 'admin',
                status: 1,
            };

            mockDb.limit.mockResolvedValueOnce([mockUser]);

            const result = await service.getCurrentUser(1);

            expect(result.username).toBe('testuser');
        });

        it('should throw NotFoundException for non-existent user', async () => {
            mockDb.limit.mockResolvedValueOnce([]);

            await expect(service.getCurrentUser(999)).rejects.toThrow(NotFoundException);
        });
    });

    describe('changePassword', () => {
        it('should change password successfully', async () => {
            const mockUser = {
                id: 1,
                password_hash: 'oldhash',
            };

            mockDb.limit.mockResolvedValueOnce([mockUser]);
            (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
            (bcrypt.hash as jest.Mock).mockResolvedValueOnce('newhash');

            const result = await service.changePassword(1, {
                oldPassword: 'oldpassword',
                newPassword: 'newpassword123',
            });

            expect(result.message).toBe('Password changed successfully');
        });

        it('should throw UnauthorizedException for wrong old password', async () => {
            const mockUser = {
                id: 1,
                password_hash: 'oldhash',
            };

            mockDb.limit.mockResolvedValueOnce([mockUser]);
            (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

            await expect(
                service.changePassword(1, {
                    oldPassword: 'wrongpassword',
                    newPassword: 'newpassword123',
                })
            ).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('createUser', () => {
        it('should create a new user', async () => {
            mockDb.limit.mockResolvedValueOnce([]); // no existing username
            mockDb.limit.mockResolvedValueOnce([]); // no existing email
            (bcrypt.hash as jest.Mock).mockResolvedValueOnce('hashedpassword');
            mockDb.returning.mockResolvedValueOnce([{
                id: 1,
                username: 'newuser',
                email: 'new@example.com',
                role: 'viewer',
            }]);

            const result = await service.createUser({
                username: 'newuser',
                email: 'new@example.com',
                password: 'password123',
            });

            expect(result.username).toBe('newuser');
        });

        it('should throw BadRequestException for duplicate username', async () => {
            mockDb.limit.mockResolvedValueOnce([{ id: 1 }]); // existing username

            await expect(
                service.createUser({
                    username: 'existinguser',
                    email: 'new@example.com',
                    password: 'password123',
                })
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException for duplicate email', async () => {
            mockDb.limit.mockResolvedValueOnce([]); // no existing username
            mockDb.limit.mockResolvedValueOnce([{ id: 1 }]); // existing email

            await expect(
                service.createUser({
                    username: 'newuser',
                    email: 'existing@example.com',
                    password: 'password123',
                })
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('validateToken', () => {
        it('should return payload for valid token', () => {
            const mockPayload = { userId: 1, username: 'testuser', role: 'admin' };
            (jwt.verify as jest.Mock).mockReturnValueOnce(mockPayload);

            const result = service.validateToken('valid-token');

            expect(result).toEqual(mockPayload);
        });

        it('should throw UnauthorizedException for invalid token', () => {
            (jwt.verify as jest.Mock).mockImplementationOnce(() => {
                throw new Error('Invalid token');
            });

            expect(() => service.validateToken('invalid-token')).toThrow(
                UnauthorizedException
            );
        });
    });
});
