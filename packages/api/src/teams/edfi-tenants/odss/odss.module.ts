import { Module } from '@nestjs/common';
import { OdssController } from './odss.controller';

@Module({
  controllers: [OdssController],
})
export class OdssModule {}
