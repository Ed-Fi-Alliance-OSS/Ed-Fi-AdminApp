import { Module } from '@nestjs/common';
import { SbEnvironmentsController } from './sb-environments.controller';

@Module({
  controllers: [SbEnvironmentsController],
})
export class SbEnvironmentsModule {}
