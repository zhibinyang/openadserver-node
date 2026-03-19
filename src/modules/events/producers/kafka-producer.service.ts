import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Admin, TopicMessages } from 'kafkajs';

import { EventType } from '../types/event.types';

// Topic names for each event type (uppercase to match Flink SQL)
const EVENT_TOPICS: Record<EventType, string> = {
  [EventType.REQUEST]: 'REQUEST',
  [EventType.AD]: 'AD',
  [EventType.IMPRESSION]: 'IMPRESSION',
  [EventType.CLICK]: 'CLICK',
  [EventType.CONVERSION]: 'CONVERSION',
  [EventType.VIDEO_VTR]: 'VIDEO_VTR',
};

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private admin: Admin | null = null;
  private isConnected = false;
  private readonly brokers: string[];
  private readonly clientId: string;
  private readonly compression: 'gzip' | 'snappy' | 'lz4' | 'zstd' | 'none';

  constructor(private readonly configService: ConfigService) {
    this.brokers = this.configService
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',')
      .map((b) => b.trim());
    this.clientId = this.configService.get<string>('KAFKA_CLIENT_ID', 'openadserver');
    this.compression = this.configService.get<'gzip' | 'snappy' | 'lz4' | 'zstd' | 'none'>(
      'KAFKA_COMPRESSION',
      'snappy',
    );
  }

  async onModuleInit(): Promise<void> {
    const kafkaEnabled = this.configService.get<string>('KAFKA_ENABLED', 'false') === 'true';

    if (!kafkaEnabled) {
      this.logger.log('Kafka is disabled, skipping initialization');
      return;
    }

    try {
      await this.connect();
    } catch (error) {
      this.logger.error('Failed to initialize Kafka producer', error);
      // Don't throw - allow the service to start without Kafka
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Connect to Kafka and create topics if needed
   */
  async connect(): Promise<void> {
    try {
      this.kafka = new Kafka({
        brokers: this.brokers,
        clientId: this.clientId,
        // KRaft mode doesn't need ZooKeeper
        // Connection retry configuration
        retry: {
          initialRetryTime: 100,
          retries: 8,
          maxRetryTime: 30000,
          multiplier: 2,
        },
      });

      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        idempotent: true,
        maxInFlightRequests: 5,
      });

      this.admin = this.kafka.admin();

      await this.admin.connect();
      await this.producer.connect();

      // Ensure topics exist
      await this.ensureTopics();

      this.isConnected = true;
      this.logger.log(`Connected to Kafka at ${this.brokers.join(', ')}`);
    } catch (error) {
      this.logger.error('Failed to connect to Kafka', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    try {
      if (this.producer && this.isConnected) {
        await this.producer.disconnect();
      }
      if (this.admin) {
        await this.admin.disconnect();
      }
      this.isConnected = false;
      this.logger.log('Disconnected from Kafka');
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka', error);
    }
  }

  /**
   * Ensure all required topics exist
   */
  private async ensureTopics(): Promise<void> {
    if (!this.admin) {
      return;
    }

    const topics = Object.values(EVENT_TOPICS).map((topic) => ({
      topic,
      numPartitions: 3,
      replicationFactor: 1,
      configEntries: [
        { name: 'retention.ms', value: '604800000' }, // 7 days
        { name: 'compression.type', value: this.compression },
      ],
    }));

    try {
      await this.admin.createTopics({
        topics,
        waitForLeaders: true,
      });
      this.logger.log('Kafka topics ensured');
    } catch (error: any) {
      // Topics might already exist
      if (!error.message?.includes('already exists')) {
        this.logger.warn('Failed to create topics', error);
      }
    }
  }

  /**
   * Send an event to Kafka
   */
  async send(eventType: EventType, data: Buffer, key?: string): Promise<void> {
    if (!this.producer || !this.isConnected) {
      throw new Error('Kafka producer not connected');
    }

    const topic = EVENT_TOPICS[eventType];

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: key || `${eventType}-${Date.now()}`,
            value: data,
            timestamp: Date.now().toString(),
            headers: {
              eventType,
              encoding: 'protobuf',
            },
          },
        ],
      });

      this.logger.debug(`Sent ${eventType} event to topic ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to send ${eventType} event to Kafka`, error);
      throw error;
    }
  }

  /**
   * Send multiple events in a batch
   */
  async sendBatch(events: Array<{ eventType: EventType; data: Buffer; key?: string }>): Promise<void> {
    if (!this.producer || !this.isConnected) {
      throw new Error('Kafka producer not connected');
    }

    // Group by topic
    const topicMessages: Record<string, TopicMessages> = {};

    for (const event of events) {
      const topic = EVENT_TOPICS[event.eventType];
      if (!topicMessages[topic]) {
        topicMessages[topic] = {
          topic,
          messages: [],
        };
      }
      topicMessages[topic].messages.push({
        key: event.key || `${event.eventType}-${Date.now()}`,
        value: event.data,
        timestamp: Date.now().toString(),
        headers: {
          eventType: event.eventType,
          encoding: 'protobuf',
        },
      });
    }

    try {
      await this.producer.sendBatch({
        topicMessages: Object.values(topicMessages),
      });

      this.logger.debug(`Sent batch of ${events.length} events to Kafka`);
    } catch (error) {
      this.logger.error('Failed to send batch to Kafka', error);
      throw error;
    }
  }

  /**
   * Check if Kafka is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (!this.admin || !this.isConnected) {
      return false;
    }

    try {
      await this.admin.describeCluster();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.isConnected && this.producer !== null;
  }

  /**
   * Get Kafka metadata
   */
  async getMetadata(): Promise<{
    brokers: number;
    topics: number;
    connected: boolean;
  }> {
    if (!this.admin || !this.isConnected) {
      return { brokers: 0, topics: 0, connected: false };
    }

    try {
      const metadata = await this.admin.describeCluster();
      const topics = await this.admin.listTopics();

      return {
        brokers: metadata.brokers.length,
        topics: topics.length,
        connected: true,
      };
    } catch {
      return { brokers: 0, topics: 0, connected: false };
    }
  }
}
