import { Injectable, Logger } from '@nestjs/common';
import * as protobuf from 'protobufjs';
import { join } from 'path';

import {
  EventType,
  SlotType,
  CreativeType,
  BidType,
  VideoEventType,
  RequestEvent,
  AdEvent,
  ImpressionEvent,
  ClickEvent,
  ConversionEvent,
  VideoVTREvent,
} from '../types/event.types';

@Injectable()
export class ProtoEncoderService {
  private readonly logger = new Logger(ProtoEncoderService.name);
  private root: protobuf.Root | null = null;
  private messageTypes: Map<EventType, protobuf.Type> = new Map();

  async onModuleInit(): Promise<void> {
    try {
      this.root = new protobuf.Root();

      // Load proto files from source directory (works in dev and production)
      const projectRoot = process.cwd();
      const schemaPath = join(projectRoot, 'src', 'modules', 'events', 'schemas');

      await this.loadProtoFile(join(schemaPath, 'request.proto'));
      await this.loadProtoFile(join(schemaPath, 'ad.proto'));
      await this.loadProtoFile(join(schemaPath, 'impression.proto'));
      await this.loadProtoFile(join(schemaPath, 'click.proto'));
      await this.loadProtoFile(join(schemaPath, 'conversion.proto'));
      await this.loadProtoFile(join(schemaPath, 'video_vtr.proto'));

      // Cache message types
      this.messageTypes.set(EventType.REQUEST, this.root.lookupType('events.RequestEvent'));
      this.messageTypes.set(EventType.AD, this.root.lookupType('events.AdEvent'));
      this.messageTypes.set(EventType.IMPRESSION, this.root.lookupType('events.ImpressionEvent'));
      this.messageTypes.set(EventType.CLICK, this.root.lookupType('events.ClickEvent'));
      this.messageTypes.set(EventType.CONVERSION, this.root.lookupType('events.ConversionEvent'));
      this.messageTypes.set(EventType.VIDEO_VTR, this.root.lookupType('events.VideoVTREvent'));

      this.logger.log('Protobuf schemas loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load protobuf schemas', error);
      throw error;
    }
  }

  private async loadProtoFile(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      protobuf.load(path, this.root!, (err, root) => {
        if (err) {
          reject(err);
        } else {
          if (root) {
            this.root = root;
          }
          resolve();
        }
      });
    });
  }

  /**
   * Encode a RequestEvent to protobuf
   */
  encodeRequest(event: RequestEvent): Buffer {
    const messageType = this.messageTypes.get(EventType.REQUEST);
    if (!messageType) {
      throw new Error('RequestEvent type not loaded');
    }

    const payload = {
      requestId: event.requestId,
      eventTime: event.eventTime,
      userIds: event.userIds
        ? {
            userId: event.userIds.userId,
            hashedEmail: event.userIds.hashedEmail,
            hashedPhone: event.userIds.hashedPhone,
            deviceId: event.userIds.deviceId,
            cookiesyncId: event.userIds.cookiesyncId,
            extendedIds: event.userIds.extendedIds,
          }
        : undefined,
      segments: event.segments,
      slotId: event.slotId,
      slotType: event.slotType,
      ip: event.ip,
      country: event.country,
      city: event.city,
      device: event.device,
      browser: event.browser,
      os: event.os,
      referer: event.referer,
      pageContext: event.pageContext,
      responseCount: event.responseCount,
      hasWinner: event.hasWinner,
      winningBid: event.winningBid,
    };

    const err = messageType.verify(payload);
    if (err) {
      throw new Error(`RequestEvent verification failed: ${err}`);
    }

    const message = messageType.create(payload);
    return Buffer.from(messageType.encode(message).finish());
  }

  /**
   * Encode an AdEvent to protobuf
   */
  encodeAd(event: AdEvent): Buffer {
    const messageType = this.messageTypes.get(EventType.AD);
    if (!messageType) {
      throw new Error('AdEvent type not loaded');
    }

    const payload = {
      requestId: event.requestId,
      impressionId: event.impressionId,
      clickId: event.clickId,
      campaignId: event.campaignId,
      creativeId: event.creativeId,
      advertiserId: event.advertiserId,
      eventTime: event.eventTime,
      bid: event.bid,
      ecpm: event.ecpm,
      cost: event.cost,
      bidType: event.bidType,
      creativeType: event.creativeType,
      bannerWidth: event.bannerWidth,
      bannerHeight: event.bannerHeight,
      videoDuration: event.videoDuration,
      slotId: event.slotId,
      pctr: event.pctr,
      pcvr: event.pcvr,
      landingUrl: event.landingUrl,
    };

    const err = messageType.verify(payload);
    if (err) {
      throw new Error(`AdEvent verification failed: ${err}`);
    }

    const message = messageType.create(payload);
    return Buffer.from(messageType.encode(message).finish());
  }

  /**
   * Encode an ImpressionEvent to protobuf
   */
  encodeImpression(event: ImpressionEvent): Buffer {
    const messageType = this.messageTypes.get(EventType.IMPRESSION);
    if (!messageType) {
      throw new Error('ImpressionEvent type not loaded');
    }

    const payload = {
      clickId: event.clickId,
      eventTime: event.eventTime,
    };

    const err = messageType.verify(payload);
    if (err) {
      throw new Error(`ImpressionEvent verification failed: ${err}`);
    }

    const message = messageType.create(payload);
    return Buffer.from(messageType.encode(message).finish());
  }

  /**
   * Encode a ClickEvent to protobuf
   */
  encodeClick(event: ClickEvent): Buffer {
    const messageType = this.messageTypes.get(EventType.CLICK);
    if (!messageType) {
      throw new Error('ClickEvent type not loaded');
    }

    const payload = {
      clickId: event.clickId,
      eventTime: event.eventTime,
    };

    const err = messageType.verify(payload);
    if (err) {
      throw new Error(`ClickEvent verification failed: ${err}`);
    }

    const message = messageType.create(payload);
    return Buffer.from(messageType.encode(message).finish());
  }

  /**
   * Encode a ConversionEvent to protobuf
   */
  encodeConversion(event: ConversionEvent): Buffer {
    const messageType = this.messageTypes.get(EventType.CONVERSION);
    if (!messageType) {
      throw new Error('ConversionEvent type not loaded');
    }

    const payload = {
      clickId: event.clickId,
      eventTime: event.eventTime,
      conversionValue: event.conversionValue,
      conversionType: event.conversionType,
      attributes: event.attributes,
    };

    const err = messageType.verify(payload);
    if (err) {
      throw new Error(`ConversionEvent verification failed: ${err}`);
    }

    const message = messageType.create(payload);
    return Buffer.from(messageType.encode(message).finish());
  }

  /**
   * Encode a VideoVTREvent to protobuf
   */
  encodeVideoVTR(event: VideoVTREvent): Buffer {
    const messageType = this.messageTypes.get(EventType.VIDEO_VTR);
    if (!messageType) {
      throw new Error('VideoVTREvent type not loaded');
    }

    const payload = {
      clickId: event.clickId,
      eventTime: event.eventTime,
      eventType: event.eventType,
      progressPercent: event.progressPercent,
    };

    const err = messageType.verify(payload);
    if (err) {
      throw new Error(`VideoVTREvent verification failed: ${err}`);
    }

    const message = messageType.create(payload);
    return Buffer.from(messageType.encode(message).finish());
  }

  /**
   * Encode any event based on type
   */
  encode(eventType: EventType, event: unknown): Buffer {
    switch (eventType) {
      case EventType.REQUEST:
        return this.encodeRequest(event as RequestEvent);
      case EventType.AD:
        return this.encodeAd(event as AdEvent);
      case EventType.IMPRESSION:
        return this.encodeImpression(event as ImpressionEvent);
      case EventType.CLICK:
        return this.encodeClick(event as ClickEvent);
      case EventType.CONVERSION:
        return this.encodeConversion(event as ConversionEvent);
      case EventType.VIDEO_VTR:
        return this.encodeVideoVTR(event as VideoVTREvent);
      default:
        throw new Error(`Unknown event type: ${eventType}`);
    }
  }
}
