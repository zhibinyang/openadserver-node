import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, EachMessagePayload, Consumer, Admin } from 'kafkajs';

import { EventType } from '../types/event.types';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka;
  private consumer: Consumer | null = null;
  private admin: Admin | null = null;
  private readonly groupId: string;
  private readonly topics: string[];
  private running = false;

  // Callback for processing messages
  private messageHandler: ((eventType: EventType, data: Buffer) => Promise<void>) | null = null;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService.get<string>('KAFKA_BROKERS', 'localhost:9092').split(',');
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID', 'openadserver');
    this.groupId = this.configService.get<string>('KAFKA_CONSUMER_GROUP_ID', 'openadserver-consumer');

    this.kafka = new Kafka({
      clientId: `${clientId}-consumer`,
      brokers,
    });

    // All event topics
    this.topics = [
      EventType.REQUEST,
      EventType.AD,
      EventType.IMPRESSION,
      EventType.CLICK,
      EventType.CONVERSION,
      EventType.VIDEO_VTR,
    ];
  }

  async onModuleInit(): Promise<void> {
    const kafkaEnabled = this.configService.get<string>('KAFKA_ENABLED', 'false') === 'true';
    const consumerEnabled = this.configService.get<string>('KAFKA_CONSUMER_ENABLED', 'false') === 'true';

    if (!kafkaEnabled || !consumerEnabled) {
      this.logger.log('Kafka consumer disabled');
      return;
    }

    try {
      // Create admin for topic management
      this.admin = this.kafka.admin();
      await this.admin.connect();

      // Ensure topics exist
      await this.ensureTopics();

      // Create consumer
      this.consumer = this.kafka.consumer({
        groupId: this.groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 10000,
        maxBytesPerPartition: 1048576, // 1MB
      });

      await this.consumer.connect();
      this.logger.log('Kafka consumer connected');

      // Subscribe to all event topics
      for (const topic of this.topics) {
        await this.consumer.subscribe({ topic, fromBeginning: false });
        this.logger.log(`Subscribed to topic: ${topic}`);
      }

      // Start consuming
      this.running = true;
      this.startConsuming();
    } catch (error) {
      this.logger.error('Failed to initialize Kafka consumer', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    if (this.consumer) {
      await this.consumer.disconnect();
      this.logger.log('Kafka consumer disconnected');
    }
    if (this.admin) {
      await this.admin.disconnect();
    }
  }

  /**
   * Set the message handler callback
   */
  setMessageHandler(handler: (eventType: EventType, data: Buffer) => Promise<void>): void {
    this.messageHandler = handler;
  }

  /**
   * Ensure all required topics exist
   */
  private async ensureTopics(): Promise<void> {
    if (!this.admin) return;

    const numPartitions = this.configService.get<number>('KAFKA_NUM_PARTITIONS', 3);
    const replicationFactor = this.configService.get<number>('KAFKA_REPLICATION_FACTOR', 1);

    for (const topic of this.topics) {
      try {
        await this.admin.createTopics({
          topics: [{
            topic,
            numPartitions,
            replicationFactor,
            configEntries: [
              { name: 'retention.ms', value: '604800000' }, // 7 days
              { name: 'cleanup.policy', value: 'delete' },
            ],
          }],
        });
        this.logger.debug(`Topic ${topic} created or already exists`);
      } catch (error: any) {
        if (!error.message?.includes('already exists')) {
          this.logger.warn(`Failed to create topic ${topic}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Start consuming messages
   */
  private startConsuming(): void {
    if (!this.consumer) return;

    this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        const { topic, message } = payload;

        if (!message.value) {
          return;
        }

        const eventType = topic as EventType;

        try {
          if (this.messageHandler) {
            await this.messageHandler(eventType, message.value);
          }
        } catch (error) {
          this.logger.error(`Failed to process message from topic ${topic}`, error);
          // Don't throw - consumer will continue processing
        }
      },
    }).catch((error) => {
      this.logger.error('Consumer error', error);
    });
  }

  /**
   * Check if consumer is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (!this.consumer) return false;

    try {
      // Simple check - if we're connected and running
      return this.running;
    } catch {
      return false;
    }
  }

  /**
   * Get consumer statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    groupId: string;
    topics: string[];
  }> {
    return {
      connected: this.consumer !== null && this.running,
      groupId: this.groupId,
      topics: this.topics,
    };
  }
}
