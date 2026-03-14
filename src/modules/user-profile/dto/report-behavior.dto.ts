import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';

export class ReportBehaviorDto {
    @IsString()
    user_id: string;

    @IsString()
    behavior_type: string; // e.g. 'click', 'view', 'purchase', 'search'

    @IsOptional()
    @IsString()
    category?: string; // e.g. 'auto', 'finance', 'education'

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    interests?: string[]; // Interests associated with this behavior

    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>; // Extra behavior metadata
}
