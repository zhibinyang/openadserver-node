
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import {
    CreateAdvertiserDto, UpdateAdvertiserDto,
    CreateCampaignDto, UpdateCampaignDto,
    CreateCreativeDto, UpdateCreativeDto,
    CreateTargetingRuleDto, UpdateTargetingRuleDto
} from './dto/admin.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'viewer')
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    // --- Advertisers ---
    @Get('advertisers')
    getAdvertisers() {
        return this.adminService.getAdvertisers();
    }

    @Post('advertisers')
    @Roles('admin')
    createAdvertiser(@Body() data: CreateAdvertiserDto) {
        return this.adminService.createAdvertiser(data);
    }

    @Put('advertisers/:id')
    @Roles('admin')
    updateAdvertiser(@Param('id') id: string, @Body() data: UpdateAdvertiserDto) {
        return this.adminService.updateAdvertiser(Number(id), data);
    }

    @Delete('advertisers/:id')
    @Roles('admin')
    deleteAdvertiser(@Param('id') id: string) {
        return this.adminService.deleteAdvertiser(Number(id));
    }

    // --- Campaigns ---
    @Get('campaigns')
    getCampaigns(@Query('advertiser_id') advertiserId?: string) {
        return this.adminService.getCampaigns(advertiserId ? Number(advertiserId) : undefined);
    }

    @Post('campaigns')
    @Roles('admin')
    createCampaign(@Body() data: CreateCampaignDto) {
        return this.adminService.createCampaign(data);
    }

    @Put('campaigns/:id')
    @Roles('admin')
    updateCampaign(@Param('id') id: string, @Body() data: UpdateCampaignDto) {
        return this.adminService.updateCampaign(Number(id), data);
    }

    @Delete('campaigns/:id')
    @Roles('admin')
    deleteCampaign(@Param('id') id: string) {
        return this.adminService.deleteCampaign(Number(id));
    }

    // --- Creatives ---
    @Get('creatives')
    getCreatives(@Query('campaign_id') campaignId?: string) {
        return this.adminService.getCreatives(campaignId ? Number(campaignId) : undefined);
    }

    @Post('creatives')
    @Roles('admin')
    createCreative(@Body() data: CreateCreativeDto) {
        return this.adminService.createCreative(data);
    }

    @Put('creatives/:id')
    @Roles('admin')
    updateCreative(@Param('id') id: string, @Body() data: UpdateCreativeDto) {
        return this.adminService.updateCreative(Number(id), data);
    }

    @Delete('creatives/:id')
    @Roles('admin')
    deleteCreative(@Param('id') id: string) {
        return this.adminService.deleteCreative(Number(id));
    }

    // --- Targeting Rules ---
    @Get('targeting')
    getTargetingRules(@Query('campaign_id') campaignId?: string) {
        return this.adminService.getTargetingRules(campaignId ? Number(campaignId) : undefined);
    }

    @Post('targeting')
    @Roles('admin')
    createTargetingRule(@Body() data: CreateTargetingRuleDto) {
        return this.adminService.createTargetingRule(data);
    }

    @Put('targeting/:id')
    @Roles('admin')
    updateTargetingRule(@Param('id') id: string, @Body() data: UpdateTargetingRuleDto) {
        return this.adminService.updateTargetingRule(Number(id), data);
    }

    @Delete('targeting/:id')
    @Roles('admin')
    deleteTargetingRule(@Param('id') id: string) {
        return this.adminService.deleteTargetingRule(Number(id));
    }

    // --- Ad Events ---
    @Get('events')
    getAdEvents(@Query('limit') limit?: string) {
        const limitNum = limit ? Math.min(Number(limit), 1000) : 100; // Default 100, max 1000
        return this.adminService.getAdEvents(limitNum);
    }

    // --- Audience Interests ---
    @Get('interests')
    getInterests() {
        return this.adminService.getInterests();
    }

    // --- Pacing ---
    @Get('pacing')
    getPacing() {
        return this.adminService.getPacing();
    }
}
