/**
 * SSP Controller
 * REST API for managing SSP adapters
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SspRegistry } from './ssp-registry.service';
import { SspConfig, SspHealthStatus } from './types/ssp-adapter.types';

@Controller('ssp')
export class SspController {
  constructor(private readonly registry: SspRegistry) {}

  /**
   * Get all registered SSP adapters
   * GET /ssp/adapters
   */
  @Get('adapters')
  listAdapters() {
    const stats = this.registry.getStats();
    const adapters = this.registry.getAllMetadata().map(meta => {
      const config = this.registry.getAdapterConfig(meta.id);
      return {
        ...meta,
        enabled: config?.enabled ?? false,
      };
    });

    return {
      success: true,
      data: {
        stats,
        adapters,
      },
    };
  }

  /**
   * Get a specific adapter
   * GET /ssp/adapters/:id
   */
  @Get('adapters/:id')
  getAdapter(@Param('id') id: string) {
    const adapter = this.registry.getAdapter(id);
    if (!adapter) {
      throw new NotFoundException(`Adapter ${id} not found`);
    }

    const config = this.registry.getAdapterConfig(id);
    return {
      success: true,
      data: {
        id: adapter.id,
        name: adapter.name,
        enabled: adapter.enabled,
        config,
      },
    };
  }

  /**
   * Update adapter configuration
   * PUT /ssp/adapters/:id/config
   */
  @Put('adapters/:id/config')
  async updateConfig(
    @Param('id') id: string,
    @Body() config: Partial<SspConfig>,
  ) {
    const success = await this.registry.updateConfig(id, config);
    if (!success) {
      throw new NotFoundException(`Adapter ${id} not found`);
    }

    return {
      success: true,
      message: `Configuration updated for adapter ${id}`,
    };
  }

  /**
   * Enable an adapter
   * POST /ssp/adapters/:id/enable
   */
  @Post('adapters/:id/enable')
  @HttpCode(HttpStatus.OK)
  async enableAdapter(@Param('id') id: string) {
    const success = await this.registry.enableAdapter(id);
    if (!success) {
      throw new NotFoundException(`Adapter ${id} not found`);
    }

    return {
      success: true,
      message: `Adapter ${id} enabled`,
    };
  }

  /**
   * Disable an adapter
   * POST /ssp/adapters/:id/disable
   */
  @Post('adapters/:id/disable')
  @HttpCode(HttpStatus.OK)
  async disableAdapter(@Param('id') id: string) {
    const success = await this.registry.disableAdapter(id);
    if (!success) {
      throw new NotFoundException(`Adapter ${id} not found`);
    }

    return {
      success: true,
      message: `Adapter ${id} disabled`,
    };
  }

  /**
   * Get health status of all adapters
   * GET /ssp/health
   */
  @Get('health')
  async getHealth(): Promise<{ success: boolean; data: Record<string, SspHealthStatus> }> {
    const status = await this.registry.getHealthStatus();
    return {
      success: true,
      data: status,
    };
  }

  /**
   * Get registry statistics
   * GET /ssp/stats
   */
  @Get('stats')
  getStats() {
    return {
      success: true,
      data: this.registry.getStats(),
    };
  }
}
