
import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { BigQueryWriteClient } from '@google-cloud/bigquery-storage';
import * as protobuf from 'protobufjs';
// Required for toDescriptor
require('protobufjs/ext/descriptor');
import { AdCandidate, UserContext, EventType } from '../../shared/types';
import { DRIZZLE } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';

enum WriteTarget {
    POSTGRES = 'POSTGRES',
    BIGQUERY = 'BIGQUERY',
    BOTH = 'BOTH',
}

@Injectable()
export class AnalyticsService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(AnalyticsService.name);
    private buffer: any[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private bqClient: BigQueryWriteClient;
    private root: protobuf.Root;
    private AdEventMessage: protobuf.Type;

    private readonly projectId = process.env.GOOGLE_CLOUD_PROJECT || 'openadserver';
    private readonly datasetId = process.env.BQ_DATASET || 'analytics';
    private readonly tableId = process.env.BQ_TABLE || 'ad_events';
    private readonly writeTarget: WriteTarget;

    constructor(
        @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
    ) {
        this.bqClient = new BigQueryWriteClient();
        this.initializeProto();

        const target = process.env.WRITE_TARGET?.toUpperCase();
        if (target === 'POSTGRES') this.writeTarget = WriteTarget.POSTGRES;
        else if (target === 'BIGQUERY') this.writeTarget = WriteTarget.BIGQUERY;
        else this.writeTarget = WriteTarget.BOTH;

        this.logger.log(`Analytics Write Target: ${this.writeTarget}`);
    }

    private initializeProto() {
        const protoDefinition = `
            syntax = "proto3";

            message AdEvent {
                string request_id = 1;
                string click_id = 2;
                int32 campaign_id = 3;
                int32 creative_id = 4;
                string user_id = 5;
                string device = 6;
                string browser = 7;
                int32 event_type = 8;
                int64 event_time = 9;
                double cost = 10;
                string ip = 11;
                string country = 12;
                string city = 13;
                double bid = 14;
                double price = 15;
            }
        `;
        const { parse } = protobuf;
        this.root = parse(protoDefinition, { keepCase: true }).root;
        this.AdEventMessage = this.root.lookupType("AdEvent");
    }

    onModuleInit() {
        // Flush every 60 seconds
        this.flushTimer = setInterval(() => {
            this.flush();
        }, 60000);
    }

    onModuleDestroy() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.flush(); // Attempt final flush
    }

    /**
     * Track an event (Impression, Click, Conversion)
     */
    async trackEvent(event: any) {
        // Validate or transform event here if necessary

        // 1. Write to Postgres (Immediate for now)
        if (this.writeTarget === WriteTarget.POSTGRES || this.writeTarget === WriteTarget.BOTH) {
            // Fire and forget to avoid blocking main flow, but log errors
            this.writeToPostgres(event).catch(err =>
                this.logger.error('Failed to write to Postgres', err)
            );
        }

        // 2. Buffer for BigQuery
        if (this.writeTarget === WriteTarget.BIGQUERY || this.writeTarget === WriteTarget.BOTH) {
            this.buffer.push(event);

            if (this.buffer.length >= 50) {
                this.flush();
            }
        }
    }

    private async writeToPostgres(event: any) {
        // Map event to Postgres schema
        // Note: event_time is in micros for BQ, but Postgres expects Date object or ISO string?
        // Let's check how event_time is passed. 
        // In previous changes, we converted to micros in `writeToBigQuery`.
        // So the input `event` here likely has `event_time` as ms number (from Date.now()).

        // Wait, let's check usage in EngineController/TrackingService.
        // EngineController: event_time: Date.now()
        // TrackingService: event_time: eventTime.getTime() (ms)

        // So input is ms.

        await this.db.insert(schema.ad_events).values({
            request_id: event.request_id,
            click_id: event.click_id || null, // Postgres optional
            campaign_id: event.campaign_id || null,
            creative_id: event.creative_id || null,
            user_id: event.user_id || null,
            event_type: event.event_type || EventType.IMPRESSION,
            event_time: new Date(event.event_time), // Convert ms to Date
            cost: (event.cost || 0).toString(),

            // New columns
            ip: event.ip || null,
            country: event.country || null,
            city: event.city || null,
            device: event.device || null,
            browser: event.browser || null,
            bid: (event.bid || 0).toString(),
            price: (event.price || 0).toString(),
        });
    }

    private async flush() {
        if (this.buffer.length === 0) return;

        const batch = [...this.buffer];
        this.buffer = []; // Clear buffer immediately

        try {
            const sampleIds = batch.length > 0
                ? `[${batch[0].request_id} ... ${batch[batch.length - 1].request_id}]`
                : '';
            this.logger.log(`Flushing ${batch.length} events to BigQuery. IDs: ${sampleIds}`);
            await this.writeToBigQuery(batch);
            this.logger.log(`Successfully flushed ${batch.length} events.`);
        } catch (error) {
            this.logger.error('Failed to flush events to BigQuery', error);
            // Optional: Re-queue failed events or write to dead-letter file
            // For now, we log and drop to avoid memory leaks in a "bug free" simple implementation
        }
    }

    private async writeToBigQuery(rows: any[]) {
        const parent = `projects/${this.projectId}/datasets/${this.datasetId}/tables/${this.tableId}`;
        const writeStream = `${parent}/_default`;

        const protoRows = rows.map(row => {
            // Ensure types match proto definition
            const payload = {
                request_id: row.request_id || '',
                click_id: row.click_id || '',
                campaign_id: row.campaign_id || 0,
                creative_id: row.creative_id || 0,
                user_id: row.user_id || '',
                device: row.device || '',
                browser: row.browser || '',
                event_type: row.event_type || EventType.IMPRESSION,
                event_time: (row.event_time ? row.event_time : Date.now()) * 1000, // Convert ms to micros
                cost: row.cost || 0.0,
                ip: row.ip || '',
                country: row.country || '',
                city: row.city || '',
                bid: row.bid || 0.0,
                price: row.price || 0.0,
            };

            // Verify message
            const err = this.AdEventMessage.verify(payload);
            if (err) {
                this.logger.error(`Proto verification failed: ${err}`, payload);
                return null;
            }

            // Encode
            const message = this.AdEventMessage.create(payload);
            return this.AdEventMessage.encode(message).finish();
        }).filter(Boolean);

        if (protoRows.length === 0) return;

        // Construct the request
        const request = {
            writeStream: writeStream,
            protoRows: {
                writerSchema: {
                    protoDescriptor: this.getProtoDescriptor(),
                },
                rows: {
                    serializedRows: protoRows,
                },
            },
        };

        // Open a new stream for this batch (Simple, stateless approach)
        const stream = await this.bqClient.appendRows();

        return new Promise<void>((resolve, reject) => {
            stream.on('data', (data: any) => {
                // Check for errors in response
                if (data.error) {
                    reject(new Error(JSON.stringify(data.error)));
                } else {
                    // Success: We received a response from BigQuery
                    resolve();
                }
            });

            stream.on('error', (err: any) => {
                reject(err);
            });

            stream.write(request);
            stream.end();
            // We wait for 'data' or 'error' event to resolve/reject
        });
    }

    private getProtoDescriptor() {
        // Manual construction to avoid protobufjs toDescriptor compatibility issues
        const fields = [];
        // Map proto types to DescriptorProto.Type enum values
        const typeMap: Record<string, number> = {
            'double': 1,
            'float': 2,
            'int64': 3,
            'uint64': 4,
            'int32': 5,
            'fixed64': 6,
            'fixed32': 7,
            'bool': 8,
            'string': 9,
            'group': 10,
            'message': 11,
            'bytes': 12,
            'uint32': 13,
            'enum': 14,
            'sfixed32': 15,
            'sfixed64': 16,
            'sint32': 17,
            'sint64': 18
        };

        for (const key in this.AdEventMessage.fields) {
            const field = this.AdEventMessage.fields[key];
            fields.push({
                name: field.name,
                number: field.id,
                type: typeMap[field.type] || 9, // Default to string if unknown
                label: 1, // LABEL_OPTIONAL (proto3 default)
                // options: { packed: false }
            });
        }

        return {
            name: "AdEvent",
            field: fields
        };
    }
}
