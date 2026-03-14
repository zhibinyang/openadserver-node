import { Controller, Post, Get, Delete, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { SegmentService } from '../engine/services/segment.service';

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
     * 添加用户到人群包
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
     * 查询用户所属的人群包列表
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
