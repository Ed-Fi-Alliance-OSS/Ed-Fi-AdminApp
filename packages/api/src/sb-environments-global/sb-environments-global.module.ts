import { Module } from '@nestjs/common';
import { SbEnvironmentsGlobalController } from './sb-environments-global.controller';

@Module({
  controllers: [SbEnvironmentsGlobalController],
})
export class SbEnvironmentsGlobalModule {}
