
import { IsString, IsOptional, IsNumber, IsObject, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class AdRequestDto {
    @IsString()
    slot_id: string;

    @IsString()
    @IsOptional()
    user_id?: string;

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

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    num_ads?: number = 1;
}
