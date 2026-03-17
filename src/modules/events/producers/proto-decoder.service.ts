import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as protobuf from 'protobufjs';

import { EventType, AnyEvent } from '../types/event.types';

@Injectable()
export class ProtoDecoderService implements OnModuleInit {
  private readonly logger = new Logger(ProtoDecoderService.name);
  private root: protobuf.Root | null = null;
  private messageTypes: Map<EventType, protobuf.Type> = new Map();

  async onModuleInit(): Promise<void> {
    try {
      // Load all protobuf schemas
      this.root = new protobuf.Root();

      const schemaPaths = [
        './src/modules/events/schemas/request.proto',
        './src/modules/events/schemas/ad.proto',
        './src/modules/events/schemas/impression.proto',
        './src/modules/events/schemas/click.proto',
        './src/modules/events/schemas/conversion.proto',
        './src/modules/events/schemas/video_vtr.proto',
      ];

      for (const path of schemaPaths) {
        try {
          this.root.loadSync(path, { keepCase: true });
        } catch (error) {
          this.logger.warn(`Failed to load schema ${path}: ${error}`);
        }
      }

      // Map event types to message types
      this.messageTypes.set(EventType.REQUEST, this.root.lookupType('RequestEvent'));
      this.messageTypes.set(EventType.AD, this.root.lookupType('AdEvent'));
      this.messageTypes.set(EventType.IMPRESSION, this.root.lookupType('ImpressionEvent'));
      this.messageTypes.set(EventType.CLICK, this.root.lookupType('ClickEvent'));
      this.messageTypes.set(EventType.CONVERSION, this.root.lookupType('ConversionEvent'));
      this.messageTypes.set(EventType.VIDEO_VTR, this.root.lookupType('VideoVTREvent'));

      this.logger.log('ProtoDecoderService initialized');
    } catch (error) {
      this.logger.error('Failed to initialize ProtoDecoderService', error);
      throw error;
    }
  }

  /**
   * Decode a protobuf buffer to an event object
   */
  decode(eventType: EventType, data: Buffer): AnyEvent {
    const messageType = this.messageTypes.get(eventType);
    if (!messageType) {
      throw new Error(`Unknown event type: ${eventType}`);
    }

    try {
      const message = messageType.decode(data);
      const plainObject = messageType.toObject(message, {
        longs: Number,
        enums: String,
        bytes: String,
        defaults: true,
        arrays: true,
        objects: true,
        oneofs: true,
      });

      return this.transformKeys(plainObject, eventType);
    } catch (error) {
      this.logger.error(`Failed to decode ${eventType}`, error);
      throw error;
    }
  }

  /**
   * Transform snake_case protobuf keys to camelCase for TypeScript
   */
  private transformKeys(obj: any, eventType: EventType): AnyEvent {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const transform = (o: any): any => {
      if (Array.isArray(o)) {
        return o.map(transform);
      }

      if (o && typeof o === 'object') {
        const result: any = {};
        for (const key of Object.keys(o)) {
          const camelKey = this.toCamelCase(key);
          result[camelKey] = transform(o[key]);
        }
        return result;
      }

      return o;
    };

    return transform(obj);
  }

  /**
   * Convert snake_case to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
