
import { IsString, IsOptional, IsNumber, IsObject, IsArray, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Supported identity types for user identification
 */
export enum IdentityType {
    DEVICE_ID = 'device_id',
    IDFA = 'idfa',
    GAID = 'gaid',
    OAID = 'oaid',
    EMAIL_HASH = 'email_hash',
    PHONE_HASH = 'phone_hash',
    CUSTOM = 'custom',
}

export class AdRequestDto {
    @IsString()
    slot_id: string;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    slot_type?: number; // CreativeType enum: 1=BANNER, 2=NATIVE, 3=VIDEO, 4=INTERSTITIAL

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    slot_width?: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    slot_height?: number;

    // Legacy user_id (backward compatibility)
    @IsString()
    @IsOptional()
    user_id?: string;

    // New identity fields for flexible user identification
    @IsString()
    @IsOptional()
    identity_type?: string; // device_id, idfa, gaid, oaid, email_hash, phone_hash, custom

    @IsString()
    @IsOptional()
    identity_value?: string; // The actual ID value

    @IsString()
    @IsOptional()
    ip?: string;

    // Device Info
    @IsString()
    @IsOptional()
    os?: string;

    @IsString()
    @IsOptional()
    device?: string;

    @IsString()
    @IsOptional()
    browser?: string;

    // Geo Info (optional overrides, usually derived from IP in real app)
    @IsString()
    @IsOptional()
    country?: string;

    @IsString()
    @IsOptional()
    city?: string;

    // App Info
    @IsString()
    @IsOptional()
    app_id?: string;

    // ML Features
    @IsNumber()
    @IsOptional()
    age?: number;

    @IsString()
    @IsOptional()
    gender?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    interests?: string[];

    @IsString()
    @IsOptional()
    page_context?: string; // Page context info from the requesting page

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    num_ads?: number = 1;
}
