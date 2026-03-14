/**
 * OpenRTB 2.6 Type Definitions
 * Reference: https://www.iab.com/guidelines/openrtb/
 */

// ==================== Top Level Objects ====================

export interface OpenRtbBidRequest {
  id: string;
  imp: OpenRtbImp[];
  site?: OpenRtbSite;
  app?: OpenRtbApp;
  device?: OpenRtbDevice;
  user?: OpenRtbUser;
  test?: number;
  at?: number;
  tmax?: number;
  wseat?: string[];
  bseat?: string[];
  allimps?: number;
  cur?: string[];
  wlang?: string[];
  bcat?: string[];
  badv?: string[];
  bapp?: string[];
  source?: OpenRtbSource;
  regs?: OpenRtbRegs;
  ext?: Record<string, any>;
}

export interface OpenRtbBidResponse {
  id: string;
  seatbid?: OpenRtbSeatBid[];
  bidid?: string;
  cur?: string;
  customdata?: string;
  nbr?: number;
  ext?: Record<string, any>;
}

// ==================== Impression Objects ====================

export interface OpenRtbImp {
  id: string;
  banner?: OpenRtbBanner;
  video?: OpenRtbVideo;
  audio?: OpenRtbAudio;
  native?: OpenRtbNative;
  displaymanager?: string;
  displaymanagerver?: string;
  instl?: number;
  tagid?: string;
  bidfloor?: number;
  bidfloorcur?: string;
  secure?: number;
  iframebuster?: string[];
  exp?: number;
  ext?: Record<string, any>;
}

export interface OpenRtbBanner {
  w?: number;
  h?: number;
  format?: OpenRtbFormat[];
  id?: string;
  pos?: number;
  btype?: number[];
  battr?: number[];
  mimes?: string[];
  topframe?: number;
  expdir?: number[];
  api?: number[];
  ext?: Record<string, any>;
}

export interface OpenRtbFormat {
  w: number;
  h: number;
  wratio?: number;
  hratio?: number;
  wmin?: number;
  hmin?: number;
  ext?: Record<string, any>;
}

export interface OpenRtbVideo {
  mimes?: string[];
  minduration?: number;
  maxduration?: number;
  protocols?: number[];
  protocol?: number;
  w?: number;
  h?: number;
  startdelay?: number;
  placement?: number;
  linearity?: number;
  skip?: number;
  skipmin?: number;
  skipafter?: number;
  sequence?: number;
  battr?: number[];
  maxextended?: number;
  minbitrate?: number;
  maxbitrate?: number;
  boxingallowed?: number;
  playbackmethod?: number[];
  delivery?: number[];
  pos?: number;
  companionad?: OpenRtbBanner[];
  api?: number[];
  companiontype?: number[];
  ext?: Record<string, any>;
}

export interface OpenRtbAudio {
  mimes?: string[];
  minduration?: number;
  maxduration?: number;
  startdelay?: number;
  sequence?: number;
  battr?: number[];
  maxextended?: number;
  minbitrate?: number;
  maxbitrate?: number;
  delivery?: number[];
  companionad?: OpenRtbBanner[];
  api?: number[];
  companiontype?: number[];
  ext?: Record<string, any>;
}

export interface OpenRtbNative {
  request: string | OpenRtbNativeRequest;
  ver?: string;
  api?: number[];
  battr?: number[];
  ext?: Record<string, any>;
}

export interface OpenRtbNativeRequest {
  native?: {
    ver?: string;
    assets?: any[];
    link?: any;
    privacy?: number;
    ext?: Record<string, any>;
  };
}

// ==================== Site & App Objects ====================

export interface OpenRtbSite {
  id?: string;
  name?: string;
  domain?: string;
  cat?: string[];
  sectioncat?: string[];
  pagecat?: string[];
  page?: string;
  ref?: string;
  search?: string;
  mobile?: number;
  privacypolicy?: number;
  publisher?: OpenRtbPublisher;
  content?: OpenRtbContent;
  keywords?: string;
  ext?: Record<string, any>;
}

export interface OpenRtbApp {
  id?: string;
  name?: string;
  bundle?: string;
  domain?: string;
  storeurl?: string;
  cat?: string[];
  sectioncat?: string[];
  pagecat?: string[];
  ver?: string;
  privacypolicy?: number;
  paid?: number;
  publisher?: OpenRtbPublisher;
  content?: OpenRtbContent;
  keywords?: string;
  ext?: Record<string, any>;
}

export interface OpenRtbPublisher {
  id?: string;
  name?: string;
  cat?: string[];
  domain?: string;
  ext?: Record<string, any>;
}

export interface OpenRtbContent {
  id?: string;
  episode?: number;
  title?: string;
  series?: string;
  season?: string;
  artist?: string;
  genre?: string;
  album?: string;
  isrc?: string;
  producer?: OpenRtbProducer;
  url?: string;
  cat?: string[];
  videoquality?: number;
  context?: number;
  contentrating?: string;
  userrating?: string;
  qagmediarating?: number;
  keywords?: string;
  livestream?: number;
  sourcerelationship?: number;
  len?: number;
  language?: string;
  embeddable?: number;
  ext?: Record<string, any>;
}

export interface OpenRtbProducer {
  id?: string;
  name?: string;
  cat?: string[];
  domain?: string;
  ext?: Record<string, any>;
}

// ==================== Device & User Objects ====================

export interface OpenRtbDevice {
  ua?: string;
  geo?: OpenRtbGeo;
  dnt?: number;
  lmt?: number;
  ip?: string;
  ipv6?: string;
  devicetype?: number;
  make?: string;
  model?: string;
  os?: string;
  osv?: string;
  hwv?: string;
  h?: number;
  w?: number;
  ppi?: number;
  pxratio?: number;
  js?: number;
  geofetch?: number;
  flashver?: string;
  language?: string;
  carrier?: string;
  mccmnc?: string;
  connectiontype?: number;
  ifa?: string;
  didsha1?: string;
  didmd5?: string;
  dpidsha1?: string;
  dpidmd5?: string;
  macsha1?: string;
  macmd5?: string;
  ipuch?: string;
  ext?: Record<string, any>;
}

export interface OpenRtbGeo {
  lat?: number;
  lon?: number;
  type?: number;
  accuracy?: number;
  lastfix?: number;
  country?: string;
  region?: string;
  regionfips104?: string;
  metro?: string;
  city?: string;
  zip?: string;
  utcoffset?: number;
  ext?: Record<string, any>;
}

export interface OpenRtbUser {
  id?: string;
  buyeruid?: string;
  yob?: number;
  gender?: string;
  keywords?: string;
  customdata?: string;
  geo?: OpenRtbGeo;
  data?: OpenRtbData[];
  ext?: Record<string, any>;
}

export interface OpenRtbData {
  id?: string;
  name?: string;
  segment?: OpenRtbSegment[];
  ext?: Record<string, any>;
}

export interface OpenRtbSegment {
  id?: string;
  name?: string;
  value?: string;
  ext?: Record<string, any>;
}

// ==================== Source & Regs Objects ====================

export interface OpenRtbSource {
  fd?: number;
  tid?: string;
  pchain?: string;
  ext?: Record<string, any>;
}

export interface OpenRtbRegs {
  coppa?: number;
  gdpr?: number;
  us_privacy?: string;
  ext?: Record<string, any>;
}

// ==================== Bid Response Objects ====================

export interface OpenRtbSeatBid {
  bid: OpenRtbBid[];
  seat?: string;
  group?: number;
  ext?: Record<string, any>;
}

export interface OpenRtbBid {
  id: string;
  impid: string;
  price: number;
  adid?: string;
  nurl?: string;
  burl?: string;
  lurl?: string;
  adm?: string;
  adomain?: string[];
  bundle?: string;
  iurl?: string;
  cid?: string;
  crid?: string;
  tactic?: string;
  cat?: string[];
  attr?: number[];
  api?: number;
  protocol?: number;
  qagmediarating?: number;
  language?: string;
  dealid?: string;
  w?: number;
  h?: number;
  wratio?: number;
  hratio?: number;
  exp?: number;
  ext?: Record<string, any>;
}

// ==================== Enums ====================

export enum OpenRtbNoBidReason {
  UNKNOWN_ERROR = 0,
  TECHNICAL_ERROR = 1,
  INVALID_REQUEST = 2,
  KNOWN_SPIDER = 3,
  SUSPECTED_NONHUMAN = 4,
  CLOUD_DATACENTER_PROXY_IP = 5,
  UNSUPPORTED_DEVICE = 6,
  PUBLISHER_BLOCKED = 7,
  UNMAPPED_VERTICAL = 8,
  UNMAPPED_CONTENT = 9,
  BLOCKED_BIDDER = 10,
  SUPPLY_FLOOR_NOT_MET = 11,
  SUPPLY_AUCTION_PASS = 12,
}

export enum OpenRtbConnectionType {
  UNKNOWN = 0,
  ETHERNET = 1,
  WIFI = 2,
  CELLULAR_UNKNOWN = 3,
  CELLULAR_2G = 4,
  CELLULAR_3G = 5,
  CELLULAR_4G = 6,
}

export enum OpenRtbDeviceType {
  UNKNOWN = 0,
  MOBILE = 1,
  PERSONAL_COMPUTER = 2,
  CONNECTED_TV = 3,
  PHONE = 4,
  TABLET = 5,
  CONNECTED_DEVICE = 6,
  SET_TOP_BOX = 7,
}

export enum OpenRtbVideoPlacement {
  UNKNOWN = 0,
  IN_STREAM = 1,
  IN_BANNER = 2,
  IN_ARTICLE = 3,
  IN_FEED = 4,
  INTERSTITIAL = 5,
}

export enum OpenRtbVideoProtocol {
  VAST_1_0 = 1,
  VAST_2_0 = 2,
  VAST_3_0 = 3,
  VAST_1_0_WRAPPER = 4,
  VAST_2_0_WRAPPER = 5,
  VAST_3_0_WRAPPER = 6,
  VAST_4_0 = 7,
  VAST_4_0_WRAPPER = 8,
}

export enum OpenRtbCreativeAttribute {
  AUDIO_AUTO_PLAY = 1,
  VIDEO_AUTO_PLAY = 2,
  EXPANDABLE_AUTO = 3,
  EXPANDABLE_CLICK = 4,
  EXPANDABLE_ROLLOVER = 5,
  IN_BANNER = 6,
  POP = 7,
  PROVOCATIVE = 8,
  SHAKY = 9,
  SURVEY = 10,
  TEXT = 11,
  USER_INTERACTIVE = 12,
  WINDOWS_DIALOG = 13,
  HAS_AUDIO = 14,
  AD_CAN_SKIP = 15,
  FLASH = 16,
}

export enum OpenRtbApiFramework {
  VPAID_1_0 = 1,
  VPAID_2_0 = 2,
  MRAID_1 = 3,
  ORMMA = 4,
  MRAID_2 = 5,
  MRAID_3 = 6,
  OMID_1 = 7,
}
