import { PostCertificationStepRunDto, toCertificationStepRunDto } from '@edanalytics/models';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Res,
  ServiceUnavailableException,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import {
  ReqEdfiTenant,
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../app/sb-environment-edfi-tenant.interceptor';
import { Authorize } from '../auth/authorization';
import { CertificationService } from './certification.service';

const RETRY_AFTER_SECONDS = '30';

@ApiTags('Certification')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor)
@Controller('sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/certification')
export class CertificationController {
  constructor(private readonly certificationService: CertificationService) {}

  /** Runs one certification step through the Bruno CLI and returns its saved result (AC-466). */
  @Post('sis/:sisVersion/steps/:stepId/run')
  @HttpCode(200)
  @Authorize({ privilege: 'sb-environment:update', subject: { id: 'sbEnvironmentId' } })
  async runStep(
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('sisVersion') sisVersion: string,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Body() body: PostCertificationStepRunDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.certificationService.runStep({
        sbEnvironment,
        edfiTenant,
        sisVersion,
        stepId,
        odsId: body.odsId,
        token: body.token,
        inputs: body.inputs,
      });
      return toCertificationStepRunDto(result);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        res.setHeader('Retry-After', RETRY_AFTER_SECONDS);
      }
      throw error;
    }
  }
}
