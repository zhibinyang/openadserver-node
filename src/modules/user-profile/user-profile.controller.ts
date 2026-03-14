import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { UserProfileService } from '../engine/services/user-profile.service';
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
