import {
  CatalogVersion,
  CertificationRun,
  CertificationRunComment,
  CertificationRunEvent,
  CertificationRunScenario,
  DomainCatalog,
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
import { CertificationRunListController } from './certification-run-list.controller';
import { CertificationRunListService } from './certification-run-list.service';
import { CertificationReviewController } from './certification-review.controller';
import { CertificationReviewService } from './certification-review.service';
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
      DomainCatalog,
      ScenarioCatalog,
      StepCatalog,
      CertificationRun,
      CertificationRunComment,
      CertificationRunEvent,
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
    CertificationRunListController,
    CertificationReviewController,
    CertificationRunsController,
    CertificationTeamRunsController,
    CertificationTeamDashboardController,
  ],
  providers: [
    CertificationDashboardService,
    CertificationRunListService,
    CertificationTeamDashboardService,
    CertificationReviewService,
    CertificationService,
    CertificationRunsService,
    CertificationStepRunsService,
    CertificationTargetService,
    CertificationTokenService,
  ],
})
export class CertificationModule {}
