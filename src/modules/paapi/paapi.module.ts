import { Module } from '@nestjs/common';
import { PaapiController } from './paapi.controller';

@Module({
    controllers: [PaapiController],
})
export class PaapiModule { }
