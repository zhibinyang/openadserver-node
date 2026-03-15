import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    ParseIntPipe,
    Request,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';

@Controller('api/v1/api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApiKeyController {
    constructor(private readonly apiKeyService: ApiKeyService) { }

    // User's own API keys
    @Get()
    async getMyApiKeys(@Request() req: any) {
        return this.apiKeyService.getApiKeysByUser(req.user.userId);
    }

    @Post()
    async createApiKey(@Request() req: any, @Body() createDto: CreateApiKeyDto) {
        return this.apiKeyService.createApiKey(req.user.userId, createDto);
    }

    @Get(':id')
    async getApiKeyById(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.apiKeyService.getApiKeyById(id, req.user.userId);
    }

    @Put(':id')
    async updateApiKey(
        @Request() req: any,
        @Param('id', ParseIntPipe) id: number,
        @Body() updateDto: UpdateApiKeyDto
    ) {
        return this.apiKeyService.updateApiKey(id, req.user.userId, updateDto);
    }

    @Post(':id/revoke')
    async revokeApiKey(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.apiKeyService.revokeApiKey(id, req.user.userId);
    }

    @Delete(':id')
    async deleteApiKey(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.apiKeyService.deleteApiKey(id, req.user.userId);
    }
}

@Controller('api/v1/admin/api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminApiKeyController {
    constructor(private readonly apiKeyService: ApiKeyService) { }

    // Admin: Get all API keys
    @Get()
    async getAllApiKeys() {
        return this.apiKeyService.getAllApiKeys();
    }
}
