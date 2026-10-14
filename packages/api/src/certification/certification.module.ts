import {
  CertificationProcess,
  CertificationProcessScenario,
  EdfiTenant,
  Ods,
  SbEnvironment,
  ScenarioStep,
  ScenarioStepError,
  StepCatalog,
} from '@edanalytics/models-server';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtifactModule } from './artifact/artifact.module';
import { CatalogModule } from './catalog/catalog.module';
import { CertificationCatalogController } from './certification-catalog.controller';
import { CertificationController } from './certification.controller';
import { CertificationService } from './certification.service';
import { CertificationTargetService } from './certification-target.service';
import { CertificationTokenController } from './certification-token.controller';
import { CertificationTokenService } from './certification-token.service';

@Module({
  imports: [
    ArtifactModule,
    CatalogModule,
    TypeOrmModule.forFeature([
      Ods,
      EdfiTenant,
      SbEnvironment,
      StepCatalog,
      CertificationProcess,
      CertificationProcessScenario,
      ScenarioStep,
      ScenarioStepError,
    ]),
  ],
  controllers: [
    CertificationController,
    CertificationTokenController,
    CertificationCatalogController,
  ],
  providers: [CertificationService, CertificationTargetService, CertificationTokenService],
})
export class CertificationModule {}
