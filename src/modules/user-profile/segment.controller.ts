import { Controller, Post, Get, Delete, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { SegmentService, IdentityItem } from '../engine/services/segment.service';

@Controller('api/v1/segments')
export class SegmentController {
    constructor(private readonly segmentService: SegmentService) { }

    /**
     * 创建人群包
     */
    @Post()
    async createSegment(@Body() body: {
        name: string;
        description?: string;
        type?: string;
    }) {
        if (!body.name) {
            throw new HttpException('Name is required', HttpStatus.BAD_REQUEST);
        }
        try {
            const segment = await this.segmentService.createSegment(body);
            return { success: true, data: segment };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * 获取人群包详情
     */
    @Get(':id')
    async getSegment(@Param('id') id: string) {
        const segmentId = parseInt(id, 10);
        if (isNaN(segmentId)) {
            throw new HttpException('Invalid segment ID', HttpStatus.BAD_REQUEST);
        }
        try {
            const segment = await this.segmentService.getSegment(segmentId);
            if (!segment) {
                throw new HttpException('Segment not found', HttpStatus.NOT_FOUND);
            }
            return { success: true, data: segment };
        } catch (error) {
            if (error.status === HttpStatus.NOT_FOUND) throw error;
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * 添加用户到人群包 (通过user_id)
     */
    @Post(':id/users')
    async addUsersToSegment(
        @Param('id') id: string,
        @Body() body: {
            user_ids: string[];
            expires_at?: string;
        },
    ) {
        const segmentId = parseInt(id, 10);
        if (isNaN(segmentId)) {
            throw new HttpException('Invalid segment ID', HttpStatus.BAD_REQUEST);
        }
        if (!body.user_ids || !Array.isArray(body.user_ids)) {
            throw new HttpException('user_ids must be an array', HttpStatus.BAD_REQUEST);
        }
        try {
            const expiresAt = body.expires_at ? new Date(body.expires_at) : undefined;
            const count = await this.segmentService.addUsersToSegment(segmentId, body.user_ids, expiresAt);
            return { success: true, data: { added_count: count } };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * 通过身份标识批量添加用户到人群包
     * 支持多种ID类型: device_id, idfa, gaid, email_hash 等
     *
     * @example
     * POST /api/v1/segments/1/identities
     * {
     *   "identities": [
     *     {"identity_type": "device_id", "identity_value": "abc123"},
     *     {"identity_type": "idfa", "identity_value": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"}
     *   ],
     *   "expires_at": "2024-12-31T23:59:59Z"
     * }
     */
    @Post(':id/identities')
    async addIdentitiesToSegment(
        @Param('id') id: string,
        @Body() body: {
            identities: IdentityItem[];
            expires_at?: string;
        },
    ) {
        const segmentId = parseInt(id, 10);
        if (isNaN(segmentId)) {
            throw new HttpException('Invalid segment ID', HttpStatus.BAD_REQUEST);
        }
        if (!body.identities || !Array.isArray(body.identities)) {
            throw new HttpException('identities must be an array', HttpStatus.BAD_REQUEST);
        }
        try {
            const expiresAt = body.expires_at ? new Date(body.expires_at) : undefined;
            const result = await this.segmentService.addIdentitiesToSegment(
                segmentId,
                body.identities,
                expiresAt,
            );
            return { success: true, data: result };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * 通过统一身份类型批量添加用户到人群包
     * 所有身份使用相同的类型
     *
     * @example
     * POST /api/v1/segments/1/identities/device_id
     * {
     *   "identity_values": ["abc123", "def456", "ghi789"],
     *   "expires_at": "2024-12-31T23:59:59Z"
     * }
     */
    @Post(':id/identities/:identity_type')
    async addIdentitiesToSegmentByType(
        @Param('id') id: string,
        @Param('identity_type') identityType: string,
        @Body() body: {
            identity_values: string[];
            expires_at?: string;
        },
    ) {
        const segmentId = parseInt(id, 10);
        if (isNaN(segmentId)) {
            throw new HttpException('Invalid segment ID', HttpStatus.BAD_REQUEST);
        }
        if (!body.identity_values || !Array.isArray(body.identity_values)) {
            throw new HttpException('identity_values must be an array', HttpStatus.BAD_REQUEST);
        }
        try {
            const expiresAt = body.expires_at ? new Date(body.expires_at) : undefined;
            const result = await this.segmentService.addIdentitiesToSegmentByType(
                segmentId,
                identityType,
                body.identity_values,
                expiresAt,
            );
            return { success: true, data: result };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * 查询用户所属的人群包列表 (通过user_id)
     */
    @Get('user/:user_id')
    async getUserSegments(@Param('user_id') userId: string) {
        try {
            const segmentIds = await this.segmentService.getUserSegmentIds(userId);
            return { success: true, data: { segment_ids: segmentIds } };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * 通过身份标识查询用户所属的人群包列表
     *
     * @example
     * GET /api/v1/segments/identity/device_id/abc123
     */
    @Get('identity/:identity_type/:identity_value')
    async getUserSegmentsByIdentity(
        @Param('identity_type') identityType: string,
        @Param('identity_value') identityValue: string,
    ) {
        try {
            const segmentIds = await this.segmentService.getSegmentIdsByIdentity(
                identityType,
                identityValue,
            );
            return { success: true, data: { segment_ids: segmentIds } };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * 检查身份标识是否属于指定人群包
     *
     * @example
     * GET /api/v1/segments/1/identity/device_id/abc123
     */
    @Get(':id/identity/:identity_type/:identity_value')
    async checkIdentityInSegment(
        @Param('id') id: string,
        @Param('identity_type') identityType: string,
        @Param('identity_value') identityValue: string,
    ) {
        const segmentId = parseInt(id, 10);
        if (isNaN(segmentId)) {
            throw new HttpException('Invalid segment ID', HttpStatus.BAD_REQUEST);
        }
        try {
            const isInSegment = await this.segmentService.isIdentityInSegment(
                identityType,
                identityValue,
                segmentId,
            );
            return { success: true, data: { in_segment: isInSegment } };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * 删除人群包
     */
    @Delete(':id')
    async deleteSegment(@Param('id') id: string) {
        const segmentId = parseInt(id, 10);
        if (isNaN(segmentId)) {
            throw new HttpException('Invalid segment ID', HttpStatus.BAD_REQUEST);
        }
        try {
            await this.segmentService.deleteSegment(segmentId);
            return { success: true, message: 'Segment deleted successfully' };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
