import { Controller, Get, Param, ParseIntPipe, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Authorize } from '../auth/authorization';
import { IntegrationAppsTeamService } from './integration-apps-team.service';
import { AdminApiServiceV2 } from '../teams/edfi-tenants/starting-blocks';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { InjectRepository } from '@nestjs/typeorm';
import { GetApplicationDtoV2, Ids, toApplicationYopassResponseDto } from '@edanalytics/models';
import { Repository } from 'typeorm';
import { CustomHttpException, postYopassSecret } from '../utils';

// integrationAppId in these routes is the ID of the integration app not the EdFi application ID

@ApiTags('IntegrationApp - Team')
@Controller()
export class IntegrationAppsTeamController {
  constructor(
    private readonly integrationAppsTeamService: IntegrationAppsTeamService,
    private readonly sbService: AdminApiServiceV2,
    @InjectRepository(EdfiTenant) private readonly edfiTenantRepository: Repository<EdfiTenant>,
    @InjectRepository(SbEnvironment)
    private readonly sbEnvironmentRepository: Repository<SbEnvironment>
  ) {}

  @Get()
  @Authorize({
    privilege: 'team.integration-provider.application:read',
    subject: { id: 'integrationProviderId', teamId: 'teamId' },
  })
  async getIntegrationApps(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('integrationProviderId') integrationProviderId: number
  ) {
    return await this.integrationAppsTeamService.findAll({ integrationProviderId });
  }

  @Get(':integrationAppId')
  @Authorize({
    privilege: 'team.integration-provider.application:read',
    subject: { id: 'integrationProviderId', teamId: 'teamId' },
  })
  async getOneIntegrationApp(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('integrationProviderId', new ParseIntPipe()) integrationProviderId: number,
    @Param('integrationAppId', new ParseIntPipe()) integrationAppId: number
  ) {
    return await this.integrationAppsTeamService.findOneById({
      integrationAppId,
      integrationProviderId,
    });
  }

  @Put(':integrationAppId/reset-credentials')
  @Authorize({
    privilege: 'team.integration-provider.application:reset-credentials',
    subject: {
      id: 'integrationProviderId',
      teamId: 'teamId',
    },
  })
  async resetApplicationCredentials(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('integrationProviderId', new ParseIntPipe()) integrationProviderId: number,
    @Param('integrationAppId', new ParseIntPipe()) integrationAppId: number,
    @Query('shouldGetOneTimeShareLink') shouldGetOneTimeShareLink: boolean
  ) {
    const integrationApp = await this.integrationAppsTeamService.findOneById({
      integrationAppId,
      integrationProviderId,
    });

    const edfiTenant = await this.edfiTenantRepository.findOneBy({
      id: integrationApp.edfiTenantId,
    });

    const sbEnvironment = await this.sbEnvironmentRepository.findOneBy({
      id: integrationApp.sbEnvironmentId,
    });
    edfiTenant.sbEnvironment = sbEnvironment;

    const adminApiResponse = await this.sbService.putApplicationResetCredential(
      edfiTenant,
      integrationApp.applicationId
    );

    const body = {
      ...adminApiResponse,
      url: GetApplicationDtoV2.apiUrl(
        sbEnvironment.domain,
        integrationApp.applicationName,
        edfiTenant.name
      ),
    };

    if (shouldGetOneTimeShareLink) {
      const yopass = await postYopassSecret(body);
      return toApplicationYopassResponseDto({
        link: yopass.link,
        applicationId: adminApiResponse.id,
      });
    } else {
      return body;
    }
  }
}
