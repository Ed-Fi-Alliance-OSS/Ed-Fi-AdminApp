import { Injectable } from '@nestjs/common';
import { ValidationHttpException } from '../utils';
import { InjectRepository } from '@nestjs/typeorm';
import { addUserCreating, EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { Repository } from 'typeorm';
import {
  AdminApiServiceV1,
  StartingBlocksServiceV1,
  StartingBlocksServiceV2,
} from '../teams/edfi-tenants/starting-blocks';
import { EdfiTenantsService } from '../teams/edfi-tenants/edfi-tenants.service';
import { PostSbEnvironmentDto, SbV1MetaEnv, SbV1MetaOds, EdorgType } from '@edanalytics/models';
import axios from 'axios';

@Injectable()
export class SbEnvironmentsEdFiService {
  constructor(
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    private readonly adminApiServiceV1: AdminApiServiceV1,
    private readonly startingBlocksServiceV1: StartingBlocksServiceV1,
    private readonly startingBlocksServiceV2: StartingBlocksServiceV2,
    private readonly edfiTenantService: EdfiTenantsService,
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>
  ) {}

  async create(createSbEnvironmentDto: PostSbEnvironmentDto, user: any) {
    // Validate ODS Discovery URL if provided
    if (createSbEnvironmentDto.odsApiDiscoveryUrl) {
      try {
        // Fetch ODS API metadata
        const odsApiMetaResponse = await this.fetchOdsApiMetadata(createSbEnvironmentDto);

        // const multitenantMode = createSbEnvironmentDto.isMultitenant ? "MultiTenant" : "SingleTenant";
        const sbEnvironment = await this.sbEnvironmentsRepository.save(
          addUserCreating(
            this.sbEnvironmentsRepository.create({
              name: createSbEnvironmentDto.name,
              envLabel: createSbEnvironmentDto.environmentLabel, //this field is for the lambda function
              version: createSbEnvironmentDto.version as 'v1' | 'v2',
              configPublic:
                createSbEnvironmentDto.version === 'v1'
                  ? {
                      odsApiMeta: odsApiMetaResponse,
                      adminApiUrl: createSbEnvironmentDto.adminApiUrl,
                      values: {
                        edfiHostname: createSbEnvironmentDto.odsApiDiscoveryUrl,
                        adminApiUrl: createSbEnvironmentDto.adminApiUrl,
                      },
                    }
                  : {
                      odsApiMeta: odsApiMetaResponse,
                      adminApiUrl: createSbEnvironmentDto.adminApiUrl,
                      values: {
                        meta: {
                          envlabel: createSbEnvironmentDto.environmentLabel,
                          mode: 'MultiTenant' as const,
                          domainName: createSbEnvironmentDto.odsApiDiscoveryUrl,
                          adminApiUrl: createSbEnvironmentDto.adminApiUrl,
                          tenantManagementFunctionArn: '',
                          tenantResourceTreeFunctionArn: '',
                          odsManagementFunctionArn: '',
                          edorgManagementFunctionArn: '',
                          dataFreshnessFunctionArn: '',
                        },
                      },
                    },
            }),
            user
          )
        );

        // Need to create the ODS and Edorgs, in v1 it's going to create a default tenant
        if (createSbEnvironmentDto.version === 'v1') {
          this.syncv1Environment(sbEnvironment, createSbEnvironmentDto);
          // Make a POST request to register the client
          const { clientId, displayName, clientSecret } = await this.createClientCredentials(
            createSbEnvironmentDto
          );

          // Save the admin API credentials
          const credentials = {
            ClientId: clientId,
            ClientSecret: clientSecret,
            url: createSbEnvironmentDto.adminApiUrl,
          };
          await this.startingBlocksServiceV1.saveAdminApiCredentials(sbEnvironment, credentials);
        } else if (sbEnvironment.version === 'v2') {
          // For v2, we need to investigate if applies the same process
        }

        return sbEnvironment;
      } catch (error) {
        // Enhanced error logging
        console.error('Fetch error details:', {
          url: createSbEnvironmentDto.odsApiDiscoveryUrl,
          error: error.message,
          code: error.code, // Node.js specific error codes
          cause: error.cause,
        });

        let message: string;

        if (error instanceof Error) {
          // Check for specific error types
          if (error.message.includes('ECONNREFUSED')) {
            message = 'Connection refused - service may not be running';
          } else if (error.message.includes('ENOTFOUND')) {
            message = 'Host not found - check the URL';
          } else if (error.message.includes('certificate')) {
            message = 'SSL certificate error - check certificate configuration';
          } else if (error.message.includes('ECONNRESET')) {
            message = 'Connection reset - service may have closed the connection';
          } else {
            message = `Failed to fetch ODS Discovery URL: ${error.message}`;
          }
        } else {
          message = 'Invalid or unreachable ODS Discovery URL.';
        }

        throw new ValidationHttpException({
          field: 'odsApiDiscoveryUrl',
          message,
        });
      }
    }
  }

    private async syncv1Environment(sbEnvironment: SbEnvironment, createSbEnvironmentDto: PostSbEnvironmentDto) {
        const metaV1 = {
            envlabel: sbEnvironment.envLabel,
            mode: 'DistrictSpecific', //Not sure if this is correct, but it seems to be the case
            domainName: sbEnvironment.configPublic.odsApiMeta.urls.dataManagementApi,
            odss: [
                {
                    dbname: 'EdFi_Ods_255901', // Not sure if we need to include the dbname here
                    edorgs: createSbEnvironmentDto.edOrgIds
                        ? createSbEnvironmentDto.edOrgIds.split(',').map(id => id.trim()).map(id => ({
                            educationorganizationid: parseInt(id),
                            nameofinstitution: id,
                            shortnameofinstitution: id,
                            discriminator: EdorgType['edfi.Other'],
                        }))
                        : [
                            {
                                educationorganizationid: 1,
                                nameofinstitution: 'Default EdOrg',
                                shortnameofinstitution: 'Default',
                                discriminator: EdorgType['edfi.Other'],
                            }
                        ],
                },
            ],
        } as SbV1MetaEnv;
        //Let's sync the odss and edorgs
        const result = await this.startingBlocksServiceV1.syncEnvironmentEverything(
            sbEnvironment,
            metaV1
        );
        if (result.status !== 'SUCCESS') {
            throw new ValidationHttpException({
                field: 'odsApiDiscoveryUrl',
                message: `Failed to sync environment: ${result.status}`,
            });
        }
    }

  private async createClientCredentials(createSbEnvironmentDto: PostSbEnvironmentDto) {
    const registerUrl = `${createSbEnvironmentDto.adminApiUrl}/connect/register`;
    const clientSecret = Array.from({ length: 32 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'.charAt(
        Math.floor(Math.random() * 70)
      )
    ).join('');
    const clientId = `client_${Math.random().toString(36).substring(2, 15)}`;
    const displayName = `AdminApp-v4-${Math.random().toString(36).substring(2, 8)}`;
    const formData = new URLSearchParams();
    formData.append('ClientId', clientId);
    formData.append('ClientSecret', clientSecret);
    formData.append('DisplayName', displayName);

    const registerResponse = await axios.post(registerUrl, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!registerResponse.status || registerResponse.status !== 200) {
      throw new Error(`Registration failed! status: ${registerResponse.status}`);
    }
    return { clientId, displayName, clientSecret };
  }

  private async fetchOdsApiMetadata(createSbEnvironmentDto: PostSbEnvironmentDto) {
    const response = await axios.get(createSbEnvironmentDto.odsApiDiscoveryUrl, {
      headers: {
        Accept: 'application/json',
      },
    });
    if (response.status !== 200) {
      throw new Error(`Failed to fetch ODS API metadata: ${response.statusText}`);
    }
    // Optionally validate the response contains expected discovery document structure
    const odsApiMetaResponse = response.data;
    return odsApiMetaResponse;
  }
}
