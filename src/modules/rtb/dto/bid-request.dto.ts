import { IsString, IsArray, ValidateNested, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ==================== Type Exports ====================
export type {
  OpenRtbBidRequest,
  OpenRtbBidResponse,
  OpenRtbImp,
  OpenRtbBanner,
  OpenRtbVideo,
  OpenRtbNative,
  OpenRtbSite,
  OpenRtbApp,
  OpenRtbDevice,
  OpenRtbUser,
  OpenRtbGeo,
  OpenRtbSeatBid,
  OpenRtbBid,
} from './openrtb.types';

export { OpenRtbNoBidReason } from './openrtb.types';

// ==================== DTO Classes for Validation ====================
// Note: These are simplified DTOs for validation, not full implementations

export class GeoDto {
  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lon?: number;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsNumber()
  utcoffset?: number;
}

export class BannerDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  w?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  h?: number;

  @IsOptional()
  @IsNumber()
  pos?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mimes?: string[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  api?: number[];
}

export class VideoDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mimes?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minduration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxduration?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  protocols?: number[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  w?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  h?: number;

  @IsOptional()
  @IsNumber()
  startdelay?: number;

  @IsOptional()
  @IsNumber()
  placement?: number;

  @IsOptional()
  @IsNumber()
  linearity?: number;

  @IsOptional()
  @IsNumber()
  skip?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  delivery?: number[];
}

export class NativeDto {
  @IsOptional()
  @IsString()
  ver?: string;

  // Native request can be a JSON string or object
  @IsOptional()
  request?: any;
}

export class ImpDto {
  @IsString()
  id!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BannerDto)
  banner?: BannerDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => VideoDto)
  video?: VideoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NativeDto)
  native?: NativeDto;

  @IsOptional()
  @IsString()
  tagid?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bidfloor?: number;

  @IsOptional()
  @IsString()
  bidfloorcur?: string;

  @IsOptional()
  @IsNumber()
  secure?: number;

  @IsOptional()
  @IsNumber()
  instl?: number;
}

export class SiteDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  ref?: string;

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cat?: string[];
}

export class AppDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  bundle?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  storeurl?: string;

  @IsOptional()
  @IsString()
  ver?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cat?: string[];

  @IsOptional()
  @IsString()
  keywords?: string;
}

export class DeviceDto {
  @IsOptional()
  @IsString()
  ua?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoDto)
  geo?: GeoDto;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  ipv6?: string;

  @IsOptional()
  @IsNumber()
  devicetype?: number;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  os?: string;

  @IsOptional()
  @IsString()
  osv?: string;

  @IsOptional()
  @IsNumber()
  h?: number;

  @IsOptional()
  @IsNumber()
  w?: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  carrier?: string;

  @IsOptional()
  @IsString()
  ifa?: string;

  @IsOptional()
  @IsNumber()
  connectiontype?: number;
}

export class UserDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  buyeruid?: string;

  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(2030)
  yob?: number;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoDto)
  geo?: GeoDto;
}

export class SourceDto {
  @IsOptional()
  @IsString()
  tid?: string;

  @IsOptional()
  @IsString()
  pchain?: string;
}

export class RegsDto {
  @IsOptional()
  @IsNumber()
  coppa?: number;

  @IsOptional()
  @IsNumber()
  gdpr?: number;

  @IsOptional()
  @IsString()
  us_privacy?: string;
}

export class BidRequestDto {
  @IsString()
  id!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImpDto)
  imp!: ImpDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SiteDto)
  site?: SiteDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AppDto)
  app?: AppDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceDto)
  device?: DeviceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserDto)
  user?: UserDto;

  @IsOptional()
  @IsNumber()
  test?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(2)
  at?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  tmax?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cur?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bcat?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  badv?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SourceDto)
  source?: SourceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegsDto)
  regs?: RegsDto;
}