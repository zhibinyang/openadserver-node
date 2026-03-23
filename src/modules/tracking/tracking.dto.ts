
import { IsString, IsNumberString, IsOptional, IsEnum, IsUUID } from 'class-validator';

export enum TrackingType {
    IMP = 'imp',
    CLICK = 'click',
    CONV = 'conv',
    CONVERSION = 'conversion', // Alias for CONV
    VIDEO_START = 'start',
    VIDEO_FIRST_QUARTILE = 'firstQuartile',
    VIDEO_MIDPOINT = 'midpoint',
    VIDEO_THIRD_QUARTILE = 'thirdQuartile',
    VIDEO_COMPLETE = 'complete',
}

export class TrackingDto {
    @IsEnum(TrackingType)
    type: TrackingType;

    // Primary tracking methods (imp_id = click_id = same UUIDv7)
    @IsString()
    @IsOptional()
    click_id?: string;

    @IsString()
    @IsOptional()
    imp_id?: string;

    // Legacy tracking fields (for backward compatibility)
    @IsNumberString()
    @IsOptional()
    cid?: string; // Campaign ID

    @IsNumberString()
    @IsOptional()
    crid?: string; // Creative ID

    @IsString()
    @IsOptional()
    uid?: string; // User ID

    // Optional: Conversion value for conversion events
    @IsNumberString()
    @IsOptional()
    conversion_value?: string;
}
