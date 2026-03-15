import { Inject, Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { LoginDto, ChangePasswordDto, CreateUserDto, UpdateUserDto } from './dto/auth.dto';
import { UserRole, UserStatus } from '../../database/schema';

export interface JwtPayload {
    userId: number;
    username: string;
    role: string;
}

export interface LoginResponse {
    user: {
        id: number;
        username: string;
        email: string;
        role: string;
    };
    token: string;
}

@Injectable()
export class AuthService {
    private readonly jwtSecret: string;

    constructor(
        @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
        private configService: ConfigService,
    ) {
        const secret = this.configService.get<string>('JWT_SECRET');
        if (!secret) {
            throw new Error('JWT_SECRET is not defined in environment variables');
        }
        this.jwtSecret = secret;
    }

    async login(loginDto: LoginDto): Promise<LoginResponse> {
        const { username, password } = loginDto;

        // Find user by username
        const users = await this.db.select()
            .from(schema.users)
            .where(eq(schema.users.username, username))
            .limit(1);

        const user = users[0];
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Check if user is active
        if (user.status !== UserStatus.ACTIVE) {
            throw new UnauthorizedException('User account is inactive');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Update last login time
        await this.db.update(schema.users)
            .set({ last_login_at: new Date(), updated_at: new Date() })
            .where(eq(schema.users.id, user.id));

        // Generate JWT token
        const payload: JwtPayload = {
            userId: user.id,
            username: user.username,
            role: user.role,
        };

        const token = jwt.sign(payload, this.jwtSecret, { expiresIn: '24h' });

        return {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
            token,
        };
    }

    async getCurrentUser(userId: number) {
        const users = await this.db.select({
            id: schema.users.id,
            username: schema.users.username,
            email: schema.users.email,
            role: schema.users.role,
            status: schema.users.status,
            last_login_at: schema.users.last_login_at,
            created_at: schema.users.created_at,
        })
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .limit(1);

        const user = users[0];
        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async changePassword(userId: number, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
        const { oldPassword, newPassword } = changePasswordDto;

        // Get user
        const users = await this.db.select()
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .limit(1);

        const user = users[0];
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Verify old password
        const isPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid old password');
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Update password
        await this.db.update(schema.users)
            .set({
                password_hash: newPasswordHash,
                updated_at: new Date(),
            })
            .where(eq(schema.users.id, userId));

        return { message: 'Password changed successfully' };
    }

    // User management methods
    async createUser(createUserDto: CreateUserDto) {
        const { username, email, password, role } = createUserDto;

        // Check if username already exists
        const existingUsername = await this.db.select()
            .from(schema.users)
            .where(eq(schema.users.username, username))
            .limit(1);

        if (existingUsername.length > 0) {
            throw new BadRequestException('Username already exists');
        }

        // Check if email already exists
        const existingEmail = await this.db.select()
            .from(schema.users)
            .where(eq(schema.users.email, email))
            .limit(1);

        if (existingEmail.length > 0) {
            throw new BadRequestException('Email already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = await this.db.insert(schema.users)
            .values({
                username,
                email,
                password_hash: passwordHash,
                role: role || UserRole.VIEWER,
                status: UserStatus.ACTIVE,
            })
            .returning({
                id: schema.users.id,
                username: schema.users.username,
                email: schema.users.email,
                role: schema.users.role,
                status: schema.users.status,
                created_at: schema.users.created_at,
            });

        return result[0];
    }

    async getUsers() {
        return this.db.select({
            id: schema.users.id,
            username: schema.users.username,
            email: schema.users.email,
            role: schema.users.role,
            status: schema.users.status,
            last_login_at: schema.users.last_login_at,
            created_at: schema.users.created_at,
        })
            .from(schema.users);
    }

    async getUserById(id: number) {
        const users = await this.db.select({
            id: schema.users.id,
            username: schema.users.username,
            email: schema.users.email,
            role: schema.users.role,
            status: schema.users.status,
            last_login_at: schema.users.last_login_at,
            created_at: schema.users.created_at,
        })
            .from(schema.users)
            .where(eq(schema.users.id, id))
            .limit(1);

        if (users.length === 0) {
            throw new NotFoundException('User not found');
        }

        return users[0];
    }

    async updateUser(id: number, updateUserDto: UpdateUserDto) {
        // Check if user exists
        const existing = await this.getUserById(id);

        // Check for duplicate username/email if changing
        if (updateUserDto.username && updateUserDto.username !== existing.username) {
            const duplicateUsername = await this.db.select()
                .from(schema.users)
                .where(eq(schema.users.username, updateUserDto.username))
                .limit(1);

            if (duplicateUsername.length > 0) {
                throw new BadRequestException('Username already exists');
            }
        }

        if (updateUserDto.email && updateUserDto.email !== existing.email) {
            const duplicateEmail = await this.db.select()
                .from(schema.users)
                .where(eq(schema.users.email, updateUserDto.email))
                .limit(1);

            if (duplicateEmail.length > 0) {
                throw new BadRequestException('Email already exists');
            }
        }

        const updateData: any = { ...updateUserDto, updated_at: new Date() };
        delete updateData.id;

        const result = await this.db.update(schema.users)
            .set(updateData)
            .where(eq(schema.users.id, id))
            .returning({
                id: schema.users.id,
                username: schema.users.username,
                email: schema.users.email,
                role: schema.users.role,
                status: schema.users.status,
                last_login_at: schema.users.last_login_at,
                created_at: schema.users.created_at,
            });

        return result[0];
    }

    async deleteUser(id: number) {
        // Check if user exists
        await this.getUserById(id);

        await this.db.delete(schema.users)
            .where(eq(schema.users.id, id));

        return { message: 'User deleted successfully' };
    }

    async resetUserPassword(id: number, newPassword: string) {
        // Check if user exists
        await this.getUserById(id);

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await this.db.update(schema.users)
            .set({
                password_hash: passwordHash,
                updated_at: new Date(),
            })
            .where(eq(schema.users.id, id));

        return { message: 'Password reset successfully' };
    }

    // Validate JWT token
    validateToken(token: string): JwtPayload {
        try {
            return jwt.verify(token, this.jwtSecret) as JwtPayload;
        } catch {
            throw new UnauthorizedException('Invalid token');
        }
    }
}
