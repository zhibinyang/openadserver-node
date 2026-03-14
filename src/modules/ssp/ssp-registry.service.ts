/**
 * SSP Registry
 * Manages registration and lookup of SSP adapters
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  SspAdapter,
  SspConfig,
  SspHealthStatus,
  SspAdapterMetadata,
} from './types/ssp-adapter.types';

/**
 * SSP Registry Service
 * Provides dynamic registration and management of SSP adapters
 */
@Injectable()
export class SspRegistry implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SspRegistry.name);

  /** Map of adapter ID to adapter instance */
  private readonly adapters: Map<string, SspAdapter> = new Map();

  /** Map of adapter ID to configuration */
  private readonly configs: Map<string, SspConfig> = new Map();

  /** Map of adapter metadata (for discovery) */
  private readonly metadata: Map<string, SspAdapterMetadata> = new Map();

  onModuleInit() {
    this.logger.log('SSP Registry initialized');
  }

  async onModuleDestroy() {
    this.logger.log('Disposing all SSP adapters...');
    for (const [id, adapter] of this.adapters) {
      try {
        if (adapter.dispose) {
          await adapter.dispose();
        }
      } catch (error) {
        this.logger.error(`Error disposing adapter ${id}:`, error);
      }
    }
    this.adapters.clear();
    this.configs.clear();
    this.metadata.clear();
  }

  /**
   * Register an SSP adapter
   * @param adapter The adapter instance to register
   * @param config Configuration for the adapter
   */
  async registerAdapter(adapter: SspAdapter, config: SspConfig): Promise<void> {
    const id = adapter.id;

    if (this.adapters.has(id)) {
      this.logger.warn(`Adapter ${id} already registered, replacing...`);
      await this.unregisterAdapter(id);
    }

    // Initialize the adapter
    await adapter.initialize(config);

    // Store in registry
    this.adapters.set(id, adapter);
    this.configs.set(id, config);
    this.metadata.set(id, {
      id: adapter.id,
      name: adapter.name,
      version: '1.0.0',
    });

    this.logger.log(`Registered SSP adapter: ${adapter.name} (${id}), enabled=${config.enabled}`);
  }

  /**
   * Unregister an SSP adapter
   * @param id The adapter ID to unregister
   */
  async unregisterAdapter(id: string): Promise<boolean> {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      return false;
    }

    try {
      if (adapter.dispose) {
        await adapter.dispose();
      }
    } catch (error) {
      this.logger.error(`Error disposing adapter ${id}:`, error);
    }

    this.adapters.delete(id);
    this.configs.delete(id);
    this.metadata.delete(id);

    this.logger.log(`Unregistered SSP adapter: ${id}`);
    return true;
  }

  /**
   * Get an adapter by ID
   */
  getAdapter(id: string): SspAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * Get adapter configuration
   */
  getAdapterConfig(id: string): SspConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): SspAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get all enabled adapters
   */
  getEnabledAdapters(): SspAdapter[] {
    return this.getAllAdapters().filter(adapter => adapter.enabled);
  }

  /**
   * Get all adapter metadata
   */
  getAllMetadata(): SspAdapterMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Check if an adapter is registered
   */
  hasAdapter(id: string): boolean {
    return this.adapters.has(id);
  }

  /**
   * Update adapter configuration
   */
  async updateConfig(id: string, config: Partial<SspConfig>): Promise<boolean> {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      return false;
    }

    const currentConfig = this.configs.get(id)!;
    const newConfig = { ...currentConfig, ...config };

    // Re-initialize with new config
    await adapter.initialize(newConfig);
    this.configs.set(id, newConfig);

    this.logger.log(`Updated configuration for adapter ${id}`);
    return true;
  }

  /**
   * Enable an adapter
   */
  async enableAdapter(id: string): Promise<boolean> {
    return this.updateConfig(id, { enabled: true });
  }

  /**
   * Disable an adapter
   */
  async disableAdapter(id: string): Promise<boolean> {
    return this.updateConfig(id, { enabled: false });
  }

  /**
   * Get health status of all adapters
   */
  async getHealthStatus(): Promise<Record<string, SspHealthStatus>> {
    const status: Record<string, SspHealthStatus> = {};

    for (const [id, adapter] of this.adapters) {
      try {
        if (adapter.healthCheck) {
          status[id] = await adapter.healthCheck();
        } else {
          status[id] = {
            healthy: adapter.enabled,
            message: adapter.enabled ? 'Enabled' : 'Disabled',
          };
        }
      } catch (error) {
        status[id] = {
          healthy: false,
          message: `Health check failed: ${error}`,
        };
      }
    }

    return status;
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalAdapters: number;
    enabledAdapters: number;
    disabledAdapters: number;
  } {
    const total = this.adapters.size;
    const enabled = this.getEnabledAdapters().length;
    return {
      totalAdapters: total,
      enabledAdapters: enabled,
      disabledAdapters: total - enabled,
    };
  }
}
