import { Module } from '@nestjs/common';
import { OdssGlobalController } from './odss-global.controller';

@Module({
  controllers: [OdssGlobalController],
})
export class OdssGlobalModule {}
