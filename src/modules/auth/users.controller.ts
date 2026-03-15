import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CreateUserDto, UpdateUserDto } from './dto/auth.dto';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
    constructor(private readonly authService: AuthService) { }

    @Get()
    async getUsers() {
        return this.authService.getUsers();
    }

    @Get(':id')
    async getUserById(@Param('id', ParseIntPipe) id: number) {
        return this.authService.getUserById(id);
    }

    @Post()
    async createUser(@Body() createUserDto: CreateUserDto) {
        return this.authService.createUser(createUserDto);
    }

    @Put(':id')
    async updateUser(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateUserDto: UpdateUserDto
    ) {
        return this.authService.updateUser(id, updateUserDto);
    }

    @Delete(':id')
    async deleteUser(@Param('id', ParseIntPipe) id: number) {
        return this.authService.deleteUser(id);
    }

    @Post(':id/reset-password')
    async resetUserPassword(
        @Param('id', ParseIntPipe) id: number,
        @Body('newPassword') newPassword: string
    ) {
        return this.authService.resetUserPassword(id, newPassword);
    }
}
