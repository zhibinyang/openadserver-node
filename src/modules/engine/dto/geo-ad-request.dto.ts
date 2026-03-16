
import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class GeoAdRequestDto {
    @IsString()
    query: string; // The search query

    @IsString()
    @IsOptional()
    slot_id?: string;

    @IsString()
    @IsOptional()
    user_id?: string;

    @IsString()
    @IsOptional()
    identity_type?: string;

    @IsString()
    @IsOptional()
    identity_value?: string;

    @IsString()
    @IsOptional()
    ip?: string;

    @IsString()
    @IsOptional()
    os?: string;

    @IsString()
    @IsOptional()
    device?: string;

    @IsString()
    @IsOptional()
    browser?: string;

    @IsString()
    @IsOptional()
    country?: string;

    @IsString()
    @IsOptional()
    city?: string;

    @IsString()
    @IsOptional()
    app_id?: string;

    @IsString()
    @IsOptional()
    page_context?: string;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    num_ads?: number = 3;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    min_score?: number = 0.6;
}
