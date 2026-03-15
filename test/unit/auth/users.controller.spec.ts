import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../../../src/modules/auth/users.controller';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { JwtAuthGuard } from '../../../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/modules/auth/guards/roles.guard';

describe('UsersController', () => {
    let controller: UsersController;
    let mockAuthService: any;

    beforeEach(async () => {
        mockAuthService = {
            getUsers: jest.fn(),
            getUserById: jest.fn(),
            createUser: jest.fn(),
            updateUser: jest.fn(),
            deleteUser: jest.fn(),
            resetUserPassword: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
                JwtAuthGuard,
                RolesGuard,
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<UsersController>(UsersController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getUsers', () => {
        it('should return all users', async () => {
            const mockUsers = [
                { id: 1, username: 'user1', email: 'user1@example.com', role: 'admin' },
                { id: 2, username: 'user2', email: 'user2@example.com', role: 'viewer' },
            ];
            mockAuthService.getUsers.mockResolvedValue(mockUsers);

            const result = await controller.getUsers();

            expect(result).toEqual(mockUsers);
            expect(mockAuthService.getUsers).toHaveBeenCalled();
        });
    });

    describe('getUserById', () => {
        it('should return user by id', async () => {
            const mockUser = { id: 1, username: 'user1', email: 'user1@example.com' };
            mockAuthService.getUserById.mockResolvedValue(mockUser);

            const result = await controller.getUserById(1);

            expect(result).toEqual(mockUser);
            expect(mockAuthService.getUserById).toHaveBeenCalledWith(1);
        });
    });

    describe('createUser', () => {
        it('should create a new user', async () => {
            const createDto = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123',
            };
            const mockCreated = { id: 1, ...createDto, role: 'viewer' };
            mockAuthService.createUser.mockResolvedValue(mockCreated);

            const result = await controller.createUser(createDto);

            expect(result).toEqual(mockCreated);
            expect(mockAuthService.createUser).toHaveBeenCalledWith(createDto);
        });
    });

    describe('updateUser', () => {
        it('should update user', async () => {
            const updateDto = { role: 'admin' };
            const mockUpdated = { id: 1, username: 'user1', role: 'admin' };
            mockAuthService.updateUser.mockResolvedValue(mockUpdated);

            const result = await controller.updateUser(1, updateDto);

            expect(result).toEqual(mockUpdated);
            expect(mockAuthService.updateUser).toHaveBeenCalledWith(1, updateDto);
        });
    });

    describe('deleteUser', () => {
        it('should delete user', async () => {
            mockAuthService.deleteUser.mockResolvedValue({ message: 'User deleted successfully' });

            const result = await controller.deleteUser(1);

            expect(result.message).toBe('User deleted successfully');
            expect(mockAuthService.deleteUser).toHaveBeenCalledWith(1);
        });
    });

    describe('resetUserPassword', () => {
        it('should reset user password', async () => {
            mockAuthService.resetUserPassword.mockResolvedValue({ message: 'Password reset successfully' });

            const result = await controller.resetUserPassword(1, 'newpassword123');

            expect(result.message).toBe('Password reset successfully');
            expect(mockAuthService.resetUserPassword).toHaveBeenCalledWith(1, 'newpassword123');
        });
    });
});
