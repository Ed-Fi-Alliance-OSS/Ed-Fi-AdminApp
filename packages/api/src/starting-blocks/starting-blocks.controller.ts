import {
  PostApplicationDto,
  PostClaimsetDto,
  PostVendorDto,
  PutApplicationDto,
  PutClaimsetDto,
  PutVendorDto,
  toGetVendorDto,
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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StartingBlocksServiceMock } from './starting-blocks.service.mock';

@ApiTags('Ed-Fi Resources')
@Controller()
export class StartingBlocksController {
  constructor(private readonly sbService: StartingBlocksServiceMock) {}

  @Get('vendors')
  async getVendors(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number
  ) {
    return toGetVendorDto(await this.sbService.getVendors(tenantId, sbeId));
  }

  @Get('vendors/:vendorId')
  async getVendor(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('vendorId', new ParseIntPipe()) vendorId: number
  ) {
    return toGetVendorDto(
      await this.sbService.getVendor(tenantId, sbeId, vendorId).catch((err) => {
        throw new NotFoundException();
      })
    );
  }

  @Put('vendors/:vendorId')
  async putVendor(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('vendorId', new ParseIntPipe()) vendorId: number,
    @Body() vendor: PutVendorDto
  ) {
    return toGetVendorDto(
      await this.sbService
        .putVendor(tenantId, sbeId, vendorId, vendor)
        .catch((err) => {
          throw new NotFoundException();
        })
    );
  }

  @Post('vendors')
  async postVendor(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Body() vendor: PostVendorDto
  ) {
    return toGetVendorDto(
      await this.sbService.postVendor(tenantId, sbeId, vendor)
    );
  }

  @Delete('vendors/:vendorId')
  async deleteVendor(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('vendorId', new ParseIntPipe()) vendorId: number
  ) {
    return this.sbService
      .deleteVendor(tenantId, sbeId, vendorId)
      .catch((err) => {
        throw new NotFoundException();
      });
  }

  @Get('vendors/:vendorId/applications')
  async getVendorApplications(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('vendorId', new ParseIntPipe()) vendorId: number
  ) {
    return this.sbService.getVendorApplications(tenantId, sbeId, vendorId);
  }

  @Get('applications')
  async getApplications(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number
  ) {
    return this.sbService.getApplications(tenantId, sbeId);
  }

  @Get('applications/:applicationId')
  async getApplication(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('applicationId', new ParseIntPipe()) applicationId: number
  ) {
    return this.sbService
      .getApplication(tenantId, sbeId, applicationId)
      .catch((err) => {
        throw new NotFoundException();
      });
  }

  @Put('applications/:applicationId')
  async putApplication(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @Body() application: PutApplicationDto
  ) {
    return this.sbService
      .putApplication(tenantId, sbeId, applicationId, application)
      .catch((err) => {
        throw new NotFoundException();
      });
  }

  @Post('applications')
  async postApplication(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    application: PostApplicationDto
  ) {
    return this.sbService.postApplication(tenantId, sbeId, application);
  }

  @Delete('applications/:applicationId')
  async deleteApplication(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('applicationId', new ParseIntPipe()) applicationId: number
  ) {
    return this.sbService
      .deleteApplication(tenantId, sbeId, applicationId)
      .catch((err) => {
        throw new NotFoundException();
      });
  }

  @Put('applications/:applicationId/reset-credential')
  async resetApplicationCredentials(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('applicationId', new ParseIntPipe()) applicationId: number
  ) {
    return this.sbService
      .resetApplicationCredentials(tenantId, sbeId, applicationId)
      .catch((err) => {
        throw new NotFoundException();
      });
  }

  @Get('claimsets')
  async getClaimsets(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number
  ) {
    return this.sbService.getClaimsets(tenantId, sbeId);
  }

  @Get('claimsets/:claimsetId')
  async getClaimset(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number
  ) {
    return this.sbService
      .getClaimset(tenantId, sbeId, claimsetId)
      .catch((err) => {
        throw new NotFoundException();
      });
  }

  @Put('claimsets/:claimsetId')
  async putClaimset(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number,
    @Body() claimset: PutClaimsetDto
  ) {
    return this.sbService
      .putClaimset(tenantId, sbeId, claimsetId, claimset)
      .catch((err) => {
        throw new NotFoundException();
      });
  }

  @Post('claimsets')
  async postClaimset(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Body() claimset: PostClaimsetDto
  ) {
    return this.sbService.postClaimset(tenantId, sbeId, claimset);
  }

  @Delete('claimsets/:claimsetId')
  async deleteClaimset(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number
  ) {
    return this.sbService
      .deleteClaimset(tenantId, sbeId, claimsetId)
      .catch((err) => {
        throw new NotFoundException();
      });
  }
}
