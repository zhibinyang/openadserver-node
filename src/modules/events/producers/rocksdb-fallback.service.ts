import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Level } from 'level';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { EventType, StoredEvent } from '../types/event.types';

export interface KafkaProducerLike {
  send(eventType: EventType, data: Buffer): Promise<void>;
  healthCheck(): Promise<boolean>;
}

@Injectable()
export class RocksDBFallbackService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RocksDBFallbackService.name);
  private db: Level<string, Buffer> | null = null;
  private readonly dataPath: string;
  private readonly maxQueueSize: number;
  private isFlushing = false;

  constructor(private readonly configService: ConfigService) {
    this.dataPath = this.configService.get<string>('ROCKSDB_DATA_PATH', './data/events-fallback');
    this.maxQueueSize = this.configService.get<number>('ROCKSDB_MAX_QUEUE_SIZE', 100000);
  }

  async onModuleInit(): Promise<void> {
    try {
      // Ensure directory exists
      const fs = await import('fs');
      const dir = join(process.cwd(), this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Open LevelDB
      this.db = new Level<string, Buffer>(dir, {
        valueEncoding: 'buffer',
        keyEncoding: 'utf8',
      });

      this.logger.log(`RocksDB fallback storage initialized at ${dir}`);
    } catch (error) {
      this.logger.error('Failed to initialize RocksDB fallback storage', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.logger.log('RocksDB fallback storage closed');
    }
  }

  /**
   * Store an event in the fallback queue
   */
  async store(eventType: EventType, data: Buffer): Promise<string> {
    if (!this.db) {
      throw new Error('RocksDB not initialized');
    }

    const id = uuidv4();
    const storedEvent: StoredEvent = {
      id,
      eventType,
      timestamp: Date.now(),
      data,
      retryCount: 0,
    };

    // Store with timestamp prefix for ordered retrieval
    const key = this.createKey(storedEvent);
    await this.db.put(key, Buffer.from(JSON.stringify(storedEvent)));

    this.logger.debug(`Stored event ${id} of type ${eventType} in fallback queue`);

    // Check queue size and warn if approaching limit
    const count = await this.getQueueCount();
    if (count > this.maxQueueSize * 0.9) {
      this.logger.warn(`Fallback queue is at ${count}/${this.maxQueueSize} capacity`);
    }

    return id;
  }

  /**
   * Get the current number of events in the queue
   */
  async getQueueCount(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    let count = 0;
    for await (const _ of this.db.keys()) {
      count++;
    }
    return count;
  }

  /**
   * Get all stored events (for recovery)
   */
  async getAllEvents(limit: number = 1000): Promise<StoredEvent[]> {
    if (!this.db) {
      return [];
    }

    const events: StoredEvent[] = [];
    for await (const [key, value] of this.db.iterator({ limit })) {
      try {
        const event = JSON.parse(value.toString()) as StoredEvent;
        events.push(event);
      } catch (error) {
        this.logger.error(`Failed to parse stored event with key ${key}`, error);
      }
    }
    return events;
  }

  /**
   * Remove an event from the queue after successful send
   */
  async remove(id: string): Promise<void> {
    if (!this.db) {
      return;
    }

    // Find and delete by ID
    for await (const [key, value] of this.db.iterator()) {
      try {
        const event = JSON.parse(value.toString()) as StoredEvent;
        if (event.id === id) {
          await this.db.del(key);
          this.logger.debug(`Removed event ${id} from fallback queue`);
          return;
        }
      } catch (error) {
        this.logger.error(`Failed to parse event for removal`, error);
      }
    }
  }

  /**
   * Update retry count for an event
   */
  async incrementRetryCount(id: string): Promise<void> {
    if (!this.db) {
      return;
    }

    for await (const [key, value] of this.db.iterator()) {
      try {
        const event = JSON.parse(value.toString()) as StoredEvent;
        if (event.id === id) {
          event.retryCount++;
          await this.db.put(key, Buffer.from(JSON.stringify(event)));
          return;
        }
      } catch (error) {
        this.logger.error(`Failed to update retry count for event ${id}`, error);
      }
    }
  }

  /**
   * Flush all stored events to Kafka
   * Called when Kafka recovers
   */
  async flushToKafka(producer: KafkaProducerLike): Promise<{ success: number; failed: number }> {
    if (this.isFlushing) {
      this.logger.warn('Flush already in progress, skipping');
      return { success: 0, failed: 0 };
    }

    this.isFlushing = true;
    let success = 0;
    let failed = 0;

    try {
      this.logger.log('Starting to flush events to Kafka...');

      const events = await this.getAllEvents();
      this.logger.log(`Found ${events.length} events to flush`);

      for (const event of events) {
        try {
          await producer.send(event.eventType, event.data);
          await this.remove(event.id);
          success++;
        } catch (error) {
          this.logger.error(`Failed to send event ${event.id}`, error);
          await this.incrementRetryCount(event.id);
          failed++;
        }
      }

      this.logger.log(`Flush complete: ${success} success, ${failed} failed`);
    } finally {
      this.isFlushing = false;
    }

    return { success, failed };
  }

  /**
   * Create a key for storage with timestamp prefix for ordering
   */
  private createKey(event: StoredEvent): string {
    // Pad timestamp to ensure proper ordering
    const timestamp = event.timestamp.toString().padStart(15, '0');
    return `${timestamp}:${event.id}`;
  }

  /**
   * Check if the fallback storage is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (!this.db) {
      return false;
    }

    try {
      // Try a simple operation
      await this.db.get('__health_check__').catch(() => {
        // Key doesn't exist is fine
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get statistics about the fallback queue
   */
  async getStats(): Promise<{
    queueSize: number;
    maxQueueSize: number;
    oldestEventAge: number | null;
  }> {
    const queueSize = await this.getQueueCount();
    let oldestEventAge: number | null = null;

    if (queueSize > 0 && this.db) {
      // Get the oldest event
      for await (const [_, value] of this.db.iterator({ limit: 1 })) {
        try {
          const event = JSON.parse(value.toString()) as StoredEvent;
          oldestEventAge = Date.now() - event.timestamp;
        } catch {
          // Ignore parse errors
        }
      }
    }

    return {
      queueSize,
      maxQueueSize: this.maxQueueSize,
      oldestEventAge,
    };
  }
}
