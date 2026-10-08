import { EdfiTenant, Ods, SbEnvironment } from '@edanalytics/models-server';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtifactModule } from './artifact/artifact.module';
import { CatalogModule } from './catalog/catalog.module';
import { CertificationController } from './certification.controller';
import { CertificationService } from './certification.service';
import { CertificationTokenController } from './certification-token.controller';
import { CertificationTokenService } from './certification-token.service';

@Module({
  imports: [
    ArtifactModule,
    CatalogModule,
    TypeOrmModule.forFeature([Ods, EdfiTenant, SbEnvironment]),
  ],
  controllers: [CertificationController, CertificationTokenController],
  providers: [CertificationService, CertificationTokenService],
})
export class CertificationModule {}
