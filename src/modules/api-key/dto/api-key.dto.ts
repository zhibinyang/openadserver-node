import { IsString, MinLength, MaxLength, IsOptional, IsArray, IsDateString } from 'class-validator';

export class CreateApiKeyDto {
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name!: string;

    @IsArray()
    @IsOptional()
    permissions?: string[];

    @IsDateString()
    @IsOptional()
    expires_at?: string;
}

export class UpdateApiKeyDto {
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    @IsOptional()
    name?: string;

    @IsArray()
    @IsOptional()
    permissions?: string[];

    @IsDateString()
    @IsOptional()
    expires_at?: string | null;

    @IsOptional()
    status?: number;
}
