import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthController } from './auth.controller';
import { UsersController } from './users.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
    imports: [DatabaseModule],
    controllers: [AuthController, UsersController],
    providers: [AuthService, JwtAuthGuard, RolesGuard],
    exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule { }
