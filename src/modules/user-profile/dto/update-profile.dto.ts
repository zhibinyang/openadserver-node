import { IsString, IsOptional, IsNumber, IsArray, IsObject, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProfileDto {
    @IsString()
    user_id: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    age?: number;

    @IsOptional()
    @IsEnum(['male', 'female', 'other', 'unknown'])
    gender?: 'male' | 'female' | 'other' | 'unknown';

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    interests?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @IsObject()
    custom_attributes?: Record<string, any>;
}
