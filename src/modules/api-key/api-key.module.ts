import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ApiKeyController, AdminApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';

@Module({
    imports: [DatabaseModule],
    controllers: [ApiKeyController, AdminApiKeyController],
    providers: [ApiKeyService],
    exports: [ApiKeyService],
})
export class ApiKeyModule { }
