
import { IsString, IsNumberString, IsOptional, IsEnum } from 'class-validator';

export enum TrackingType {
    IMP = 'imp',
    CLICK = 'click',
    CONV = 'conv',
    CONVERSION = 'conversion', // Alias for CONV
}

export class TrackingDto {
    @IsEnum(TrackingType)
    type: TrackingType;

    @IsNumberString()
    cid: string; // Campaign ID

    @IsNumberString()
    crid: string; // Creative ID

    @IsString()
    @IsOptional()
    uid?: string; // User ID

    // Optional: Cost override for tracking actual spend
    @IsNumberString()
    @IsOptional()
    cost?: string;
}
