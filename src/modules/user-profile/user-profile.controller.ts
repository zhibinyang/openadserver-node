import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { UserProfileService, IdentityQuery } from '../engine/services/user-profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ReportBehaviorDto } from './dto/report-behavior.dto';

@Controller('api/v1/user')
export class UserProfileController {
    constructor(private readonly userProfileService: UserProfileService) { }

    /**
     * Update or create user profile
     */
    @Post('profile')
    @HttpCode(HttpStatus.OK)
    async updateProfile(@Body() dto: UpdateProfileDto) {
        await this.userProfileService.updateProfile(dto.user_id, {
            age: dto.age,
            gender: dto.gender,
            interests: dto.interests,
            tags: dto.tags,
            custom_attributes: dto.custom_attributes,
        });

        return {
            success: true,
            message: 'Profile updated successfully',
        };
    }

    /**
     * Get user profile by user_id
     */
    @Get('profile/:user_id')
    async getProfile(@Param('user_id') userId: string) {
        const profile = await this.userProfileService.getProfile(userId);
        return {
            success: true,
            data: profile,
        };
    }

    /**
     * 通过身份标识获取用户画像
     *
     * @example
     * GET /api/v1/user/identity/device_id/abc123
     */
    @Get('identity/:identity_type/:identity_value')
    async getProfileByIdentity(
        @Param('identity_type') identityType: string,
        @Param('identity_value') identityValue: string,
    ) {
        const profile = await this.userProfileService.getProfileByIdentity({
            identity_type: identityType,
            identity_value: identityValue,
        });
        return {
            success: true,
            data: profile,
        };
    }

    /**
     * 通过身份标识更新用户画像
     * 如果用户不存在会自动创建
     *
     * @example
     * POST /api/v1/user/identity
     * {
     *   "identity_type": "device_id",
     *   "identity_value": "abc123",
     *   "age": 25,
     *   "gender": "male",
     *   "interests": ["tech", "sports"]
     * }
     */
    @Post('identity')
    @HttpCode(HttpStatus.OK)
    async updateProfileByIdentity(@Body() body: {
        identity_type: string;
        identity_value: string;
        age?: number;
        gender?: 'male' | 'female' | 'other' | 'unknown';
        interests?: string[];
        tags?: string[];
        custom_attributes?: Record<string, any>;
    }) {
        const result = await this.userProfileService.updateProfileByIdentity(
            { identity_type: body.identity_type, identity_value: body.identity_value },
            {
                age: body.age,
                gender: body.gender,
                interests: body.interests,
                tags: body.tags,
                custom_attributes: body.custom_attributes,
            },
        );

        return {
            success: true,
            message: 'Profile updated successfully',
            data: { user_id: result.user_id, is_new: result.is_new },
        };
    }

    /**
     * 为用户添加身份映射
     * 用于将多个ID关联到同一个用户
     *
     * @example
     * POST /api/v1/user/link
     * {
     *   "user_id": "u_xxx_yyy",
     *   "identity_type": "idfa",
     *   "identity_value": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
     *   "source": "sdk"
     * }
     */
    @Post('link')
    @HttpCode(HttpStatus.OK)
    async linkIdentity(@Body() body: {
        user_id: string;
        identity_type: string;
        identity_value: string;
        source?: string;
    }) {
        await this.userProfileService.linkIdentity(
            body.user_id,
            { identity_type: body.identity_type, identity_value: body.identity_value },
            body.source,
        );

        return {
            success: true,
            message: 'Identity linked successfully',
        };
    }

    /**
     * Report user behavior, auto update interests and tags
     */
    @Post('behavior')
    @HttpCode(HttpStatus.OK)
    async reportBehavior(@Body() dto: ReportBehaviorDto) {
        // Auto add interests from behavior
        if (dto.interests?.length) {
            await this.userProfileService.addInterests(dto.user_id, dto.interests);
        }

        // Auto add behavior tag
        const behaviorTag = `behavior_${dto.behavior_type}`;
        await this.userProfileService.addTags(dto.user_id, [behaviorTag]);

        // Add category tag if present
        if (dto.category) {
            const categoryTag = `category_${dto.category}`;
            await this.userProfileService.addTags(dto.user_id, [categoryTag]);
        }

        return {
            success: true,
            message: 'Behavior reported successfully',
        };
    }

    /**
     * Add interests to user
     */
    @Post('interests')
    @HttpCode(HttpStatus.OK)
    async addInterests(
        @Body() body: { user_id: string; interests: string[] }
    ) {
        await this.userProfileService.addInterests(body.user_id, body.interests);
        return {
            success: true,
            message: 'Interests added successfully',
        };
    }

    /**
     * Add tags to user
     */
    @Post('tags')
    @HttpCode(HttpStatus.OK)
    async addTags(
        @Body() body: { user_id: string; tags: string[] }
    ) {
        await this.userProfileService.addTags(body.user_id, body.tags);
        return {
            success: true,
            message: 'Tags added successfully',
        };
    }
}
