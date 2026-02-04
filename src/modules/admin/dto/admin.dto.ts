
import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsObject, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { Status, BidType, CreativeType } from '../../../shared/types';

// Advertisers
export class CreateAdvertiserDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    company?: string;

    @IsString()
    @IsOptional()
    contact_email?: string;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    balance?: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    daily_budget?: number;

    @IsEnum(Status)
    @IsOptional()
    @Type(() => Number)
    status?: Status;
}

// Campaigns
export class CreateCampaignDto {
    @IsNumber()
    @Type(() => Number)
    advertiser_id: number;

    @IsString()
    name: string;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    budget_daily?: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    budget_total?: number;

    @IsEnum(BidType)
    @IsOptional()
    @Type(() => Number)
    bid_type?: BidType;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    bid_amount?: number;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;

    @IsEnum(Status)
    @IsOptional()
    @Type(() => Number)
    status?: Status;
}

// Creatives
export class CreateCreativeDto {
    @IsNumber()
    @Type(() => Number)
    campaign_id: number;

    @IsString()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    landing_url: string;

    @IsString()
    @IsOptional()
    image_url?: string;

    @IsEnum(CreativeType)
    @IsOptional()
    @Type(() => Number)
    creative_type?: CreativeType;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    width?: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    height?: number;

    @IsEnum(Status)
    @IsOptional()
    @Type(() => Number)
    status?: Status;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    quality_score?: number;
}

// Targeting Rules
export class CreateTargetingRuleDto {
    @IsNumber()
    @Type(() => Number)
    campaign_id: number;

    @IsString()
    rule_type: string;

    @IsObject()
    rule_value: any;

    @IsBoolean()
    @IsOptional()
    is_include?: boolean;
}

// Update DTOs
export class UpdateAdvertiserDto {
    @IsString() @IsOptional() name?: string;
    @IsString() @IsOptional() company?: string;
    @IsString() @IsOptional() contact_email?: string;
    @IsNumber() @IsOptional() @Type(() => Number) balance?: number;
    @IsNumber() @IsOptional() @Type(() => Number) daily_budget?: number;
    @IsEnum(Status) @IsOptional() @Type(() => Number) status?: Status;
}

export class UpdateCampaignDto {
    @IsNumber() @IsOptional() @Type(() => Number) advertiser_id?: number;
    @IsString() @IsOptional() name?: string;
    @IsNumber() @IsOptional() @Type(() => Number) budget_daily?: number;
    @IsNumber() @IsOptional() @Type(() => Number) budget_total?: number;
    @IsEnum(BidType) @IsOptional() @Type(() => Number) bid_type?: BidType;
    @IsNumber() @IsOptional() @Type(() => Number) bid_amount?: number;
    @IsBoolean() @IsOptional() is_active?: boolean;
    @IsEnum(Status) @IsOptional() @Type(() => Number) status?: Status;
}

export class UpdateCreativeDto {
    @IsNumber() @IsOptional() @Type(() => Number) campaign_id?: number;
    @IsString() @IsOptional() title?: string;
    @IsString() @IsOptional() description?: string;
    @IsString() @IsOptional() landing_url?: string;
    @IsString() @IsOptional() image_url?: string;
    @IsEnum(CreativeType) @IsOptional() @Type(() => Number) creative_type?: CreativeType;
    @IsNumber() @IsOptional() @Type(() => Number) width?: number;
    @IsNumber() @IsOptional() @Type(() => Number) height?: number;
    @IsEnum(Status) @IsOptional() @Type(() => Number) status?: Status;
    @IsNumber() @IsOptional() @Type(() => Number) quality_score?: number;
}

export class UpdateTargetingRuleDto {
    @IsNumber() @IsOptional() @Type(() => Number) campaign_id?: number;
    @IsString() @IsOptional() rule_type?: string;
    @IsObject() @IsOptional() rule_value?: any;
    @IsBoolean() @IsOptional() is_include?: boolean;
}
