
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import {
    CreateAdvertiserDto, UpdateAdvertiserDto,
    CreateCampaignDto, UpdateCampaignDto,
    CreateCreativeDto, UpdateCreativeDto,
    CreateTargetingRuleDto, UpdateTargetingRuleDto
} from './dto/admin.dto';

@Controller('api/v1')
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    // --- Advertisers ---
    @Get('advertisers')
    getAdvertisers() {
        return this.adminService.getAdvertisers();
    }

    @Post('advertisers')
    createAdvertiser(@Body() data: CreateAdvertiserDto) {
        return this.adminService.createAdvertiser(data);
    }

    @Put('advertisers/:id')
    updateAdvertiser(@Param('id') id: string, @Body() data: UpdateAdvertiserDto) {
        return this.adminService.updateAdvertiser(Number(id), data);
    }

    @Delete('advertisers/:id')
    deleteAdvertiser(@Param('id') id: string) {
        return this.adminService.deleteAdvertiser(Number(id));
    }

    // --- Campaigns ---
    @Get('campaigns')
    getCampaigns(@Query('advertiser_id') advertiserId?: string) {
        return this.adminService.getCampaigns(advertiserId ? Number(advertiserId) : undefined);
    }

    @Post('campaigns')
    createCampaign(@Body() data: CreateCampaignDto) {
        return this.adminService.createCampaign(data);
    }

    @Put('campaigns/:id')
    updateCampaign(@Param('id') id: string, @Body() data: UpdateCampaignDto) {
        return this.adminService.updateCampaign(Number(id), data);
    }

    @Delete('campaigns/:id')
    deleteCampaign(@Param('id') id: string) {
        return this.adminService.deleteCampaign(Number(id));
    }

    // --- Creatives ---
    @Get('creatives')
    getCreatives(@Query('campaign_id') campaignId?: string) {
        return this.adminService.getCreatives(campaignId ? Number(campaignId) : undefined);
    }

    @Post('creatives')
    createCreative(@Body() data: CreateCreativeDto) {
        return this.adminService.createCreative(data);
    }

    @Put('creatives/:id')
    updateCreative(@Param('id') id: string, @Body() data: UpdateCreativeDto) {
        return this.adminService.updateCreative(Number(id), data);
    }

    @Delete('creatives/:id')
    deleteCreative(@Param('id') id: string) {
        return this.adminService.deleteCreative(Number(id));
    }

    // --- Targeting Rules ---
    @Get('targeting')
    getTargetingRules(@Query('campaign_id') campaignId?: string) {
        return this.adminService.getTargetingRules(campaignId ? Number(campaignId) : undefined);
    }

    @Post('targeting')
    createTargetingRule(@Body() data: CreateTargetingRuleDto) {
        return this.adminService.createTargetingRule(data);
    }

    @Put('targeting/:id')
    updateTargetingRule(@Param('id') id: string, @Body() data: UpdateTargetingRuleDto) {
        return this.adminService.updateTargetingRule(Number(id), data);
    }

    @Delete('targeting/:id')
    deleteTargetingRule(@Param('id') id: string) {
        return this.adminService.deleteTargetingRule(Number(id));
    }

    // --- Ad Events ---
    @Get('events')
    getAdEvents(@Query('limit') limit?: string) {
        const limitNum = limit ? Math.min(Number(limit), 1000) : 100; // Default 100, max 1000
        return this.adminService.getAdEvents(limitNum);
    }
}
