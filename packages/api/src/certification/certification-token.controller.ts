import { Ids, PostCertificationTokenDto, toCertificationTokenDto } from '@edanalytics/models';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ReqEdfiTenant,
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../app/sb-environment-edfi-tenant.interceptor';
import { Authorize } from '../auth/authorization';
import { InjectFilter } from '../auth/helpers/inject-filter';
import { checkId } from '../auth/helpers/where-ids';
import { CERT_RUN, CERT_TENANT_PATH, CERT_TENANT_SUBJECT } from './certification-authorization';
import { CertificationSupportInterceptor } from './certification-support.interceptor';
import { CertificationTokenService } from './certification-token.service';

@ApiTags('Certification')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor, CertificationSupportInterceptor)
@Controller(CERT_TENANT_PATH)
export class CertificationTokenController {
  constructor(private readonly certificationTokenService: CertificationTokenService) {}

  /** Checks a key and secret against one of the team's data stores. They are never saved. */
  @Post('token')
  @HttpCode(200)
  @Authorize({ privilege: CERT_RUN, subject: CERT_TENANT_SUBJECT })
  async requestToken(
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() body: PostCertificationTokenDto,
    @InjectFilter(CERT_RUN) validOdsIds: Ids,
  ) {
    // Before the credentials go anywhere: the data store must be one the user may certify.
    if (!checkId(body.odsId, validOdsIds)) throw new NotFoundException();
    const result = await this.certificationTokenService.requestToken({
      sbEnvironment,
      edfiTenant,
      odsId: body.odsId,
      key: body.key,
      secret: body.secret,
    });
    return toCertificationTokenDto(result);
  }
}
