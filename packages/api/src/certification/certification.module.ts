import { Module } from '@nestjs/common';
import { CertificationService } from './certification.service';
import { CertificationController } from './certification.controller';

@Module({
  providers: [CertificationService],
  controllers: [CertificationController],
  exports: [CertificationService],
})
export class CertificationModule {}
