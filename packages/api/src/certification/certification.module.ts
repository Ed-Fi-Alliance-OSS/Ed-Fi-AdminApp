import {
  CatalogVersion,
  CertificationRun,
  CertificationRunScenario,
  EdfiTenant,
  Ods,
  SbEnvironment,
  ScenarioCatalog,
  ScenarioStep,
  ScenarioStepError,
  StepCatalog,
} from '@edanalytics/models-server';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtifactModule } from './artifact/artifact.module';
import { CatalogModule } from './catalog/catalog.module';
import { CertificationCatalogController } from './certification-catalog.controller';
import { CertificationDashboardController } from './certification-dashboard.controller';
import { CertificationDashboardService } from './certification-dashboard.service';
import { CertificationController } from './certification.controller';
import {
  CertificationRunsController,
  CertificationTeamRunsController,
} from './certification-runs.controller';
import { CertificationRunsService } from './certification-runs.service';
import { CertificationStepRunsService } from './certification-step-runs.service';
import { CertificationService } from './certification.service';
import { CertificationTargetService } from './certification-target.service';
import { CertificationTokenController } from './certification-token.controller';
import { CertificationTokenService } from './certification-token.service';
import { CertificationTeamDashboardController } from './certification-team-dashboard.controller';
import { CertificationTeamDashboardService } from './certification-team-dashboard.service';

@Module({
  imports: [
    ArtifactModule,
    CatalogModule,
    TypeOrmModule.forFeature([
      Ods,
      EdfiTenant,
      SbEnvironment,
      ScenarioCatalog,
      StepCatalog,
      CertificationRun,
      CertificationRunScenario,
      ScenarioStep,
      ScenarioStepError,
      CatalogVersion,
    ]),
  ],
  controllers: [
    CertificationController,
    CertificationTokenController,
    CertificationCatalogController,
    CertificationDashboardController,
    CertificationRunsController,
    CertificationTeamRunsController,
    CertificationTeamDashboardController,
  ],
  providers: [
    CertificationDashboardService,
    CertificationTeamDashboardService,
    CertificationService,
    CertificationRunsService,
    CertificationStepRunsService,
    CertificationTargetService,
    CertificationTokenService,
  ],
})
export class CertificationModule {}
