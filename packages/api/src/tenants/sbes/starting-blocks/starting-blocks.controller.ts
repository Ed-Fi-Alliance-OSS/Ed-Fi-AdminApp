import {
  GetApplicationDto,
  GetClaimsetDto,
  Ids,
  PostApplicationDto,
  PostApplicationForm,
  PostClaimsetDto,
  PostVendorDto,
  PutApplicationDto,
  PutApplicationForm,
  PutClaimsetDto,
  PutVendorDto,
  createEdorgCompositeNaturalKey,
  toApplicationYopassResponseDto,
  toPostApplicationResponseDto,
} from '@edanalytics/models';
import { Edorg, Sbe } from '@edanalytics/models-server';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UnauthorizedException,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { Authorize } from '../../../auth/authorization';
import { InjectFilter } from '../../../auth/helpers/inject-filter';
import { checkId } from '../../../auth/helpers/where-ids';
import {
  CustomHttpException,
  ValidationHttpException,
  isIAdminApiV1xValidationError,
  postYopassSecret,
} from '../../../utils';
import { ReqSbe, TenantSbeInterceptor } from '../tenant-sbe.interceptor';
import { AdminApiV1xExceptionFilter } from './admin-api-v1x-exception.filter';
import { AdminApiService } from './starting-blocks.service';

const uppercaseFirstLetterOfKeys = (input: any): any => {
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(uppercaseFirstLetterOfKeys);
  }

  return Object.keys(input).reduce((acc, key) => {
    const newKey = key.charAt(0).toUpperCase() + key.slice(1);
    acc[newKey] = uppercaseFirstLetterOfKeys(input[key]);
    return acc;
  }, {} as { [key: string]: any });
};

@UseFilters(new AdminApiV1xExceptionFilter())
@UseInterceptors(TenantSbeInterceptor)
@ApiTags('Ed-Fi Resources')
@Controller()
export class StartingBlocksController {
  constructor(
    private readonly sbService: AdminApiService,
    @InjectRepository(Edorg) private readonly edorgRepository: Repository<Edorg>,
    @InjectRepository(Sbe) private readonly sbeRepository: Repository<Sbe>
  ) {}

  @Get('vendors')
  @Authorize({
    privilege: 'tenant.sbe.vendor:read',
    subject: {
      id: '__filtered__',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async getVendors(
    // TODO including these unused parameters is necessary for NestJS's Open API spec generation, which uses metadata configured by the parameter decorators.
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @InjectFilter('tenant.sbe.vendor:read') validIds: Ids
  ) {
    const allVendors = await this.sbService.getVendors(sbe);
    return allVendors.filter((v) => checkId(v.id, validIds));
  }

  @Get('vendors/:vendorId')
  @Authorize({
    privilege: 'tenant.sbe.vendor:read',
    subject: {
      id: 'vendorId',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async getVendor(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Param('vendorId', new ParseIntPipe()) vendorId: number
  ) {
    return this.sbService.getVendor(sbe, vendorId);
  }

  @Put('vendors/:vendorId')
  @Authorize({
    privilege: 'tenant.sbe.vendor:update',
    subject: {
      id: 'vendorId',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async putVendor(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Param('vendorId', new ParseIntPipe()) vendorId: number,
    @Body() vendor: PutVendorDto
  ) {
    return this.sbService.putVendor(sbe, vendorId, vendor);
  }

  @Post('vendors')
  @Authorize({
    privilege: 'tenant.sbe.vendor:create',
    subject: {
      id: '__filtered__',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async postVendor(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Body() vendor: PostVendorDto
  ) {
    return this.sbService.postVendor(sbe, vendor);
  }

  @Delete('vendors/:vendorId')
  @Authorize({
    privilege: 'tenant.sbe.vendor:delete',
    subject: {
      id: 'vendorId',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async deleteVendor(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Param('vendorId', new ParseIntPipe()) vendorId: number
  ) {
    return this.sbService.deleteVendor(sbe, vendorId);
  }

  @Get('vendors/:vendorId/applications')
  @Authorize({
    privilege: 'tenant.sbe.edorg.application:read',
    subject: {
      id: '__filtered__',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async getVendorApplications(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Param('vendorId', new ParseIntPipe()) vendorId: number,
    @InjectFilter('tenant.sbe.edorg.application:read')
    validIds: Ids
  ) {
    const allApplications = await this.sbService.getVendorApplications(sbe, vendorId);
    return allApplications.filter((a) =>
      checkId(
        createEdorgCompositeNaturalKey({
          educationOrganizationId: a.educationOrganizationId,
          odsDbName: 'EdFi_Ods_' + a.odsInstanceName,
        }),
        validIds
      )
    );
  }

  @Get('applications')
  @Authorize({
    privilege: 'tenant.sbe.edorg.application:read',
    subject: {
      id: '__filtered__',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async getApplications(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @InjectFilter('tenant.sbe.edorg.application:read')
    validIds: Ids
  ) {
    const allApplications = await this.sbService.getApplications(sbe);
    return allApplications.filter((a) =>
      // TODO once Admin API is fixed so the application includes an array of edorg ids, the desired logic is to do safe operations if _any_ edorg is allowed, and unsafe ones if _all_ are allowed.
      checkId(
        createEdorgCompositeNaturalKey({
          educationOrganizationId: a.educationOrganizationId,
          odsDbName: 'EdFi_Ods_' + a.odsInstanceName,
        }),
        validIds
      )
    );
  }

  @Get('applications/:applicationId')
  @Authorize({
    privilege: 'tenant.sbe.edorg.application:read',
    subject: {
      id: '__filtered__',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async getApplication(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @InjectFilter('tenant.sbe.edorg.application:read')
    validIds: Ids
  ) {
    const application = await this.sbService.getApplication(sbe, applicationId);

    if (
      checkId(
        createEdorgCompositeNaturalKey({
          educationOrganizationId: application.educationOrganizationId,
          odsDbName: 'EdFi_Ods_' + application.odsInstanceName,
        }),
        validIds
      )
    ) {
      return application;
    } else {
      throw new NotFoundException();
    }
  }

  @Put('applications/:applicationId')
  @Authorize({
    privilege: 'tenant.sbe.edorg.application:update',
    subject: {
      id: '__filtered__',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async putApplication(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @Body() application: PutApplicationForm,
    @InjectFilter('tenant.sbe.edorg.application:update')
    validIds: Ids
  ) {
    let claimset: GetClaimsetDto;
    try {
      claimset = await this.sbService.getClaimset(sbe, application.claimsetId);
    } catch (claimsetNotFound) {
      Logger.error(claimsetNotFound);
      throw new BadRequestException('Error trying to use claimset');
    }
    if (claimset.isSystemReserved) {
      throw new ValidationHttpException({
        field: 'claimsetId',
        message: 'Cannot use system-reserved claimset',
      });
    }

    const dto = plainToInstance(PutApplicationDto, {
      ...instanceToPlain(application),
      claimSetName: claimset.name,
      educationOrganizationIds: [application.educationOrganizationId],
    });
    const edorg = await this.edorgRepository.findOneByOrFail({
      educationOrganizationId: application.educationOrganizationId,
    });
    if (
      checkId(
        createEdorgCompositeNaturalKey({
          educationOrganizationId: application.educationOrganizationId,
          odsDbName: edorg.odsDbName,
        }),
        validIds
      )
    ) {
      return this.sbService.putApplication(sbe, applicationId, dto);
    } else {
      throw new ValidationHttpException({
        field: 'educationOrganizationId',
        message: 'Invalid education organization ID',
      });
    }
  }

  @Post('applications')
  @Authorize({
    privilege: 'tenant.sbe.edorg.application:create',
    subject: {
      id: '__filtered__',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async postApplication(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Query('returnRaw') returnRaw: boolean | undefined,
    @Body() application: PostApplicationForm,
    @InjectFilter('tenant.sbe.edorg.application:create')
    validIds: Ids
  ) {
    let claimset: GetClaimsetDto;
    try {
      claimset = await this.sbService.getClaimset(sbe, application.claimsetId);
    } catch (claimsetNotFound) {
      Logger.error(claimsetNotFound);
      throw new BadRequestException('Error trying to use claimset');
    }
    if (claimset.isSystemReserved) {
      throw new ValidationHttpException({
        field: 'claimsetId',
        message: 'Cannot use system-reserved claimset',
      });
    }
    const dto = plainToInstance(PostApplicationDto, {
      ...instanceToPlain(application),
      claimSetName: claimset.name,
      educationOrganizationIds: [application.educationOrganizationId],
    });
    const edorg = await this.edorgRepository.findOneByOrFail({
      educationOrganizationId: application.educationOrganizationId,
      sbeId: sbe.id,
    });
    if (!sbe.configPublic?.edfiHostname)
      throw new InternalServerErrorException('Environment config lacks an Ed-Fi hostname.');
    if (
      checkId(
        createEdorgCompositeNaturalKey({
          educationOrganizationId: application.educationOrganizationId,
          odsDbName: edorg.odsDbName,
        }),
        validIds
      )
    ) {
      const adminApiResponse = await this.sbService.postApplication(sbe, dto);
      if (returnRaw) {
        return toPostApplicationResponseDto(adminApiResponse);
      } else {
        const yopass = await postYopassSecret({
          ...adminApiResponse,
          url: GetApplicationDto.apiUrl(
            sbe.configPublic?.edfiHostname,
            application.applicationName
          ),
        });
        return toApplicationYopassResponseDto({
          link: yopass.link,
          applicationId: adminApiResponse.applicationId,
        });
      }
    } else {
      throw new ValidationHttpException({
        field: 'educationOrganizationId',
        message: 'Invalid education organization ID',
      });
    }
  }

  @Delete('applications/:applicationId')
  @Authorize({
    privilege: 'tenant.sbe.edorg.application:delete',
    subject: {
      id: '__filtered__',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async deleteApplication(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @InjectFilter('tenant.sbe.edorg.application:delete')
    validIds: Ids
  ) {
    const application = await this.sbService.getApplication(sbe, applicationId);
    if (
      checkId(
        createEdorgCompositeNaturalKey({
          educationOrganizationId: application.educationOrganizationId,
          odsDbName: 'EdFi_Ods_' + application.odsInstanceName,
        }),
        validIds
      )
    ) {
      return this.sbService.deleteApplication(sbe, applicationId);
    } else {
      throw new NotFoundException();
    }
  }

  @Put('applications/:applicationId/reset-credential')
  @Authorize({
    privilege: 'tenant.sbe.edorg.application:reset-credentials',
    subject: {
      id: '__filtered__',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async resetApplicationCredentials(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @InjectFilter('tenant.sbe.edorg.application:reset-credentials')
    validIds: Ids
  ) {
    const application = await this.sbService.getApplication(sbe, applicationId);
    const edorg = await this.edorgRepository.findOneByOrFail({
      educationOrganizationId: application.educationOrganizationId,
      sbeId: sbe.id,
    });
    if (!sbe.configPublic?.edfiHostname)
      throw new InternalServerErrorException('Environment config lacks an Ed-Fi hostname.');
    if (
      checkId(
        createEdorgCompositeNaturalKey({
          educationOrganizationId: application.educationOrganizationId,
          odsDbName: 'EdFi_Ods_' + application.odsInstanceName,
        }),
        validIds
      )
    ) {
      const adminApiResponse = await this.sbService.resetApplicationCredentials(sbe, applicationId);
      const yopass = await postYopassSecret({
        ...adminApiResponse,
        url: GetApplicationDto.apiUrl(sbe.configPublic?.edfiHostname, application.applicationName),
      });
      return toApplicationYopassResponseDto({
        link: yopass.link,
        applicationId: adminApiResponse.applicationId,
      });
    } else {
      throw new UnauthorizedException();
    }
  }

  @Get('claimsets')
  @Authorize({
    privilege: 'tenant.sbe.claimset:read',
    subject: {
      id: '__filtered__',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async getClaimsets(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @InjectFilter('tenant.sbe.claimset:read')
    validIds: Ids
  ) {
    const allClaimsets = await this.sbService.getClaimsets(sbe);
    return allClaimsets.filter((c) => checkId(c.id, validIds));
  }
  @Get('claimsets/export')
  @Authorize({
    privilege: 'tenant.sbe.claimset:read',
    subject: {
      id: '__filtered__',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async exportClaimset(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Query('id') _ids: string[] | string,
    @Res() res: Response
  ) {
    // TODO: transformation probably shouldn't happen here, but but TBD. Possibly.
    const ids = Array.isArray(_ids) ? _ids : [_ids];
    const claimsets = await Promise.all(
      ids.map((id) => this.sbService.getClaimsetRaw(sbe, Number(id)))
    );
    const title = claimsets.length === 1 ? claimsets[0].name : `${sbe.envLabel} claimsets`;
    const document = {
      title,
      template: {
        claimSets: claimsets.map((c) => ({
          name: c.name,
          resourceClaims: uppercaseFirstLetterOfKeys(c.resourceClaims),
        })),
      },
    };
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${title.replace(/[^\w]+/g, '_')}_${Number(new Date())}.json`
    );
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(document, null, 2));
  }

  @Get('claimsets/:claimsetId')
  @Authorize({
    privilege: 'tenant.sbe.claimset:read',
    subject: {
      id: 'claimsetId',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async getClaimset(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number
  ) {
    return this.sbService.getClaimset(sbe, claimsetId);
  }

  @Put('claimsets/:claimsetId')
  @Authorize({
    privilege: 'tenant.sbe.claimset:update',
    subject: {
      id: 'claimsetId',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async putClaimset(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number,
    @Body() claimset: PutClaimsetDto
  ) {
    try {
      return await this.sbService.putClaimset(sbe, claimsetId, claimset);
    } catch (PutError: unknown) {
      Logger.error(PutError);
      // intercept some particular kinds of errors but rethrow the rest to the general exception filter
      if (axios.isAxiosError(PutError)) {
        if (isIAdminApiV1xValidationError(PutError.response?.data)) {
          if (PutError.response.data.errors?.id?.[0]?.includes('is system reserved')) {
            throw new CustomHttpException(
              {
                title: 'Cannot update system-reserved claimset',
                type: 'Error',
                data: PutError.response.data,
              },
              400
            );
          } else {
            // TODO eventually map Admin API validation errors to SBAA react-hook-form
            throw new CustomHttpException(
              {
                title: 'Validation error',
                type: 'Error',
                data: PutError.response.data,
              },
              400
            );
          }
        }
      }
      throw PutError;
    }
  }

  @Post('claimsets')
  @Authorize({
    privilege: 'tenant.sbe.claimset:create',
    subject: {
      id: '__filtered__',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async postClaimset(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Body() claimset: PostClaimsetDto
  ) {
    try {
      return await this.sbService.postClaimset(sbe, claimset);
    } catch (PostError: unknown) {
      Logger.error(PostError);
      if (axios.isAxiosError(PostError)) {
        if (isIAdminApiV1xValidationError(PostError.response?.data)) {
          if (PostError.response.data.errors?.Name?.[0]?.includes('this name already exists')) {
            throw new CustomHttpException(
              {
                title: 'A claim set with this name already exists',
                type: 'Error',
                data: PostError.response.data,
              },
              400
            );
          } else {
            // TODO eventually map Admin API validation errors to SBAA react-hook-form
            throw new CustomHttpException(
              {
                title: 'Validation error',
                type: 'Error',
                data: PostError.response.data,
              },
              400
            );
          }
        }
      }
      throw PostError;
    }
  }

  @Delete('claimsets/:claimsetId')
  @Authorize({
    privilege: 'tenant.sbe.claimset:delete',
    subject: {
      id: 'claimsetId',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async deleteClaimset(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqSbe() sbe: Sbe,
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number
  ) {
    await this.sbService.deleteClaimset(sbe, claimsetId);
    return undefined;
  }
}
