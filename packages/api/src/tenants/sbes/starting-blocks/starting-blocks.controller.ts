import {
  PostApplicationDto,
  PostClaimsetDto,
  PostVendorDto,
  PrivilegeCode,
  PutApplicationDto,
  PutClaimsetDto,
  PutVendorDto,
  toApplicationYopassResponseDto,
  toGetApplicationDto,
  toGetClaimsetDto,
  toGetVendorDto,
  toPostApplicationResponseDto,
} from '@edanalytics/models';
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StartingBlocksServiceMock } from './starting-blocks.service.mock';
import { Ids } from '../../../auth/authorization/tenant-cache.interface';
import { InjectFilter } from '../../../auth/helpers/inject-filter';
import { filterId } from '../../../auth/helpers/where-ids';
import { postYopassSecret, throwNotFound } from '../../../utils';
import { Authorize } from '../../../auth/authorization';
import { StartingBlocksService } from './starting-blocks.service';

@ApiTags('Ed-Fi Resources')
@Controller()
export class StartingBlocksController {
  constructor(private readonly sbService: StartingBlocksService) {}

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
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @InjectFilter('tenant.sbe.vendor:read') validIds: Ids
  ) {
    const allVendors = await this.sbService.getVendors(sbeId);
    return toGetVendorDto(allVendors.filter((v) => filterId(v.id, validIds)));
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
    @Param('vendorId', new ParseIntPipe()) vendorId: number
  ) {
    return toGetVendorDto(
      await this.sbService.getVendor(sbeId, vendorId).catch((err) => {
        throw new NotFoundException();
      })
    );
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
    @Param('vendorId', new ParseIntPipe()) vendorId: number,
    @Body() vendor: PutVendorDto
  ) {
    return toGetVendorDto(
      await this.sbService.putVendor(sbeId, vendorId, vendor).catch((err) => {
        throw new NotFoundException();
      })
    );
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
    @Body() vendor: PostVendorDto
  ) {
    return toGetVendorDto(await this.sbService.postVendor(sbeId, vendor));
  }

  @Delete('vendors/:vendorId')
  @Authorize({
    privilege: 'tenant.sbe.vendor:delete',
    subject: {
      id: 'odsId',
      sbeId: 'sbeId',
      tenantId: 'tenantId',
    },
  })
  async deleteVendor(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('vendorId', new ParseIntPipe()) vendorId: number
  ) {
    return this.sbService.deleteVendor(sbeId, vendorId).catch((err) => {
      throw new NotFoundException();
    });
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
    @Param('vendorId', new ParseIntPipe()) vendorId: number,
    @InjectFilter('tenant.sbe.edorg.application:read')
    validIds: Ids
  ) {
    const allApplications = await this.sbService.getVendorApplications(
      sbeId,
      vendorId
    );
    return toGetApplicationDto(
      allApplications.filter((a) =>
        filterId(a.educationOrganizationId, validIds)
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
    @InjectFilter('tenant.sbe.edorg.application:read')
    validIds: Ids
  ) {
    const allApplications = await this.sbService.getApplications(sbeId);
    return toGetApplicationDto(
      allApplications.filter((a) =>
        filterId(String(a.educationOrganizationId), validIds)
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
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @InjectFilter('tenant.sbe.edorg.application:read')
    validIds: Ids
  ) {
    const application = await this.sbService
      .getApplication(sbeId, applicationId)
      .catch(throwNotFound);
    if (filterId(String(application.educationOrganizationId), validIds)) {
      return toGetApplicationDto(application);
    } else {
      throwNotFound();
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
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @Body() application: PutApplicationDto,
    @InjectFilter('tenant.sbe.edorg.application:read')
    validIds: Ids
  ) {
    if (
      application.educationOrganizationIds.every((id) => filterId(id, validIds))
    ) {
      return toGetApplicationDto(
        await this.sbService.putApplication(sbeId, applicationId, application)
      );
    } else {
      throw new UnauthorizedException();
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
    @Query('returnRaw') returnRaw: boolean | undefined,
    @Body() application: PostApplicationDto
  ) {
    const adminApiResponse = await this.sbService.postApplication(
      sbeId,
      application
    );
    if (returnRaw) {
      return toPostApplicationResponseDto(adminApiResponse);
    } else {
      const yopass = await postYopassSecret(adminApiResponse);
      return toApplicationYopassResponseDto({
        link: yopass.link,
        applicationId: adminApiResponse.applicationId,
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
    @Param('applicationId', new ParseIntPipe()) applicationId: number
  ) {
    return this.sbService
      .deleteApplication(sbeId, applicationId)
      .catch((err) => {
        throw new NotFoundException();
      });
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
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @InjectFilter('tenant.sbe.edorg.application:read')
    validIds: Ids
  ) {
    const application = await this.sbService.getApplication(
      sbeId,
      applicationId
    );
    if (filterId(String(application.educationOrganizationId), validIds)) {
      const adminApiResponse = await this.sbService.resetApplicationCredentials(
        sbeId,
        applicationId
      );
      const yopass = await postYopassSecret(adminApiResponse);
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
    @InjectFilter('tenant.sbe.claimset:read')
    validIds: Ids
  ) {
    const allClaimsets = await this.sbService.getClaimsets(sbeId);
    return toGetClaimsetDto(
      allClaimsets.filter((c) => filterId(c.id, validIds))
    );
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
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number
  ) {
    return toGetClaimsetDto(
      await this.sbService.getClaimset(sbeId, claimsetId)
    );
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
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number,
    @Body() claimset: PutClaimsetDto
  ) {
    return toGetClaimsetDto(
      await this.sbService.putClaimset(sbeId, claimsetId, claimset)
    );
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
    @Body() claimset: PostClaimsetDto
  ) {
    return toGetClaimsetDto(await this.sbService.postClaimset(sbeId, claimset));
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
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number
  ) {
    return this.sbService
      .deleteClaimset(sbeId, claimsetId)
      .catch(throwNotFound);
  }
}
