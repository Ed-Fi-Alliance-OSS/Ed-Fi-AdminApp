# Phase 4: V3 Controller, Module Wiring, and Credential-Saving Gap Fix

> Part of [`plan.md`](./plan.md). Read that file first for Goal/Architecture/Global Constraints. Depends on [`plan-phase1-dtos.md`](./plan-phase1-dtos.md), [`plan-phase2-exception-filter.md`](./plan-phase2-exception-filter.md), and [`plan-phase3-service.md`](./plan-phase3-service.md) — this phase imports `AdminApiServiceV3` and `AdminApiV3ExceptionFilter` directly.

**Files:**
- Create: `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.controller.ts`
- Create: `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.controller.spec.ts`
- Create: `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.module.ts`
- Create: `packages/api/src/teams/edfi-tenants/starting-blocks/v3/index.ts`
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/index.ts`
- Modify: `packages/api/src/app/routes.ts`
- Modify: `packages/api/src/app/app.module.ts`
- Modify: `packages/api/src/app/services.module.ts`
- Modify: `packages/api/src/sb-environments-global/sb-environments-global.service.ts`
- Create: `packages/api/src/sb-environments-global/sb-environments-global.service.spec.ts`

**Interfaces:**
- Consumes: `AdminApiServiceV3` (Phase 3), `AdminApiV3ExceptionFilter` (Phase 2), V3 DTOs (Phase 1).
- Produces: `AdminApiControllerV3`, `AdminApiModuleV3`, fully wired into the app at `/:teamId/edfi-tenants/:edfiTenantId/admin-api/v3`.

A critical DB-schema distinction used throughout this task: the `Edorg` and `Ods` TypeORM entities (from `@edanalytics/models-server`) each have their own `odsInstanceId` column. These are **internal Admin App cache tables** that store synced data from any Admin API version — their column names are **out of scope** and must **not** be renamed to `dataStoreId`, even though the V3 Admin API *request/response DTO* fields of the same conceptual meaning are renamed. Only DTO-level field access (e.g. `application.dataStoreId` from a `PostApplicationFormDtoV3`) is renamed; `edorgRepository`/`odsRepository` calls that reference the entity's own `odsInstanceId` column stay as `odsInstanceId`.

### Task 1: Create `AdminApiControllerV3`

- [ ] **Step 1: Write the failing spec**

Create `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.controller.spec.ts` (mirrors `admin-api.v2.controller.spec.ts`'s only existing test group, `exportClaimset`, since that's the sole controller behavior currently unit-tested at this layer):

```typescript
import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Ids } from '@edanalytics/models';
import { AdminApiControllerV3 } from './admin-api.v3.controller';

describe('AdminApiControllerV3 - exportClaimset', () => {
  let controller: AdminApiControllerV3;
  let mockSbService: { exportClaimset: jest.Mock };

  const mockEdfiTenant: any = {
    id: 1,
    sbEnvironment: { envLabel: 'Test Env' },
  };

  beforeEach(() => {
    mockSbService = {
      exportClaimset: jest.fn().mockResolvedValue({
        name: 'Test Claimset',
        resourceClaims: [],
      }),
    };
    controller = new AdminApiControllerV3(
      null as any,
      mockSbService as any,
      null as any,
      null as any
    );
  });

  it('exports claimsets when validIds is true (superuser access)', async () => {
    const validIds: Ids = true;
    const result = await controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds);
    expect(mockSbService.exportClaimset).toHaveBeenCalledTimes(2);
    expect(mockSbService.exportClaimset).toHaveBeenCalledWith(mockEdfiTenant, 1);
    expect(mockSbService.exportClaimset).toHaveBeenCalledWith(mockEdfiTenant, 2);
    expect(result).toBeDefined();
  });

  it('throws ForbiddenException when one requested ID is outside the authorized set', async () => {
    const validIds: Ids = new Set([1]);
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds)
    ).rejects.toThrow(new ForbiddenException('Access denied to claimset ID: 2'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a non-integer string ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['abc'], validIds)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: abc'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when no id is provided (undefined)', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, undefined, validIds)
    ).rejects.toThrow(new BadRequestException('At least one claimset ID must be provided'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });
});

describe('AdminApiControllerV3 - getDataStores', () => {
  let controller: AdminApiControllerV3;
  let mockSbService: { getDataStores: jest.Mock };

  const mockEdfiTenant: any = { id: 1 };

  beforeEach(() => {
    mockSbService = {
      getDataStores: jest.fn().mockResolvedValue([
        { id: 1, name: 'Ods1', dataStoreType: 'Ods' },
        { id: 2, name: 'Ods2', dataStoreType: 'Ods' },
      ]),
    };
    controller = new AdminApiControllerV3(
      null as any,
      mockSbService as any,
      null as any,
      null as any
    );
  });

  it('filters data stores by the authorized ID set', async () => {
    const validIds: Ids = new Set([1]);
    const result = await controller.getDataStores(1, 1, mockEdfiTenant, validIds);
    expect(mockSbService.getDataStores).toHaveBeenCalledWith(mockEdfiTenant);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns all data stores when validIds is true (superuser access)', async () => {
    const validIds: Ids = true;
    const result = await controller.getDataStores(1, 1, mockEdfiTenant, validIds);
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx nx test api --testFile=admin-api.v3.controller.spec.ts`
Expected: FAIL — `Cannot find module './admin-api.v3.controller'`

- [ ] **Step 3: Implement `AdminApiControllerV3`**

Create `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.controller.ts`:

```typescript
import {
  CopyClaimsetDtoV3,
  GetApiClientDtoV3,
  GetApplicationDtoV3,
  GetClaimsetSingleDtoV3,
  GetIntegrationAppDto,
  Id,
  Ids,
  ImportClaimsetSingleDtoV3,
  PostApplicationDtoV3,
  PostApiClientDtoV3,
  PostApplicationFormDtoV3,
  PutApiClientDtoV3,
  PostClaimsetDtoV3,
  PostProfileDtoV3,
  PostVendorDtoV3,
  PutApplicationDtoV3,
  PutApplicationFormDtoV3,
  PutClaimsetDtoV3,
  PutProfileDtoV3,
  PutVendorDtoV3,
  SecretSharingMethod,
  edorgKeyV2,
  toApiClientYopassResponseDto,
  toApplicationYopassResponseDto,
  toPostApiClientResponseDtoV3,
  toPostApplicationResponseDto,
  toPostApplicationResponseDtoV3,
} from '@edanalytics/models';
import { EdfiTenant, Edorg, Ods, SbEnvironment } from '@edanalytics/models-server';
import {
  BadRequestException,
  Body,
  CallHandler,
  Controller,
  Delete,
  ExecutionContext,
  ForbiddenException,
  Get,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NestInterceptor,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { Response } from 'express';
import NodeCache from 'node-cache';
import { In, Repository } from 'typeorm';
import {
  ReqEdfiTenant,
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../../../../app/sb-environment-edfi-tenant.interceptor';
import { Authorize } from '../../../../auth/authorization';
import { InjectFilter } from '../../../../auth/helpers/inject-filter';
import { checkId } from '../../../../auth/helpers/where-ids';
import {
  CustomHttpException,
  ValidationHttpException,
  isIAdminApiValidationError,
  postYopassSecret,
} from '../../../../utils';
import { AdminApiV3ExceptionFilter } from './admin-api-v3-exception.filter';
import { AdminApiServiceV3 } from './admin-api.v3.service';
import { IntegrationAppsTeamService } from '../../../../integration-apps-team/integration-apps-team.service';
import config from 'config';

@Injectable()
class AdminApiV3Interceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const configPublic = request.sbEnvironment.configPublic;
    if (!('version' in configPublic && configPublic.version === 'v3')) {
      throw new NotFoundException(
        `Requested Admin API version not correct for this EdfiTenant. Use "${request.sbEnvironment.configPublic.adminApiVersion}" instead.`
      );
    }
    return next.handle();
  }
}

@UseFilters(new AdminApiV3ExceptionFilter())
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor, AdminApiV3Interceptor)
@ApiTags('Admin API Resources - v3.x')
@Controller()
export class AdminApiControllerV3 {
  private downloadCache = new NodeCache({ stdTTL: 60 * 5 /* 5 minutes */ });
  constructor(
    private readonly integrationAppsTeamService: IntegrationAppsTeamService,
    private readonly sbService: AdminApiServiceV3,
    @InjectRepository(Edorg) private readonly edorgRepository: Repository<Edorg>,
    @InjectRepository(Ods) private readonly odsRepository: Repository<Ods>
  ) { }

  /** Check application edorg IDs against auth cache for _safe_ operations (GET). Requires `some` ID to be authorized. */
  private checkApplicationEdorgsForSafeOperations(
    application: Pick<GetApplicationDtoV3, 'educationOrganizationIds' | 'dataStoreIds'>,
    validIds: Ids
  ) {
    return application.dataStoreIds.some((dataStoreId) =>
      application.educationOrganizationIds.some((edorgId) =>
        checkId(
          edorgKeyV2({
            edorg: edorgId,
            ods: dataStoreId,
          }),
          validIds
        )
      )
    );
  }

  /** Check application edorg IDs against auth cache for _unsafe_ operations (POST/PUT/DELETE). Requires `every` ID to be authorized.
   * Note that IDs which don't exist in SBAA &mdash; either because they haven't synced yet or because they don't exist in EdFi &mdash; can
   * never be authorized via an Edorg or Ods ownership, but _can_ be via an EdfiTenant or SbEnvironment ownership. This is due to some
   * quirks in the SBAA auth system design.
   */
  private checkApplicationEdorgsForUnsafeOperations(
    application: Pick<GetApplicationDtoV3, 'educationOrganizationIds' | 'dataStoreIds'>,
    validIds: Ids
  ) {
    return application.dataStoreIds.every((dataStoreId) =>
      application.educationOrganizationIds.every((edorgId) =>
        checkId(
          edorgKeyV2({
            edorg: edorgId,
            ods: dataStoreId,
          }),
          validIds
        )
      )
    );
  }

  //
  // Vendors
  //

  @Get('vendors')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.vendor:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getVendors(
    // TODO including these unused parameters is necessary for NestJS's Open API spec generation, which uses metadata configured by the parameter decorators.
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @InjectFilter('team.sb-environment.edfi-tenant.vendor:read') validIds: Ids
  ) {
    const allVendors = await this.sbService.getVendors(edfiTenant);
    return allVendors.filter((v) => checkId(v.id, validIds));
  }

  @Get('vendors/:vendorId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.vendor:read',
    subject: {
      id: 'vendorId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getVendor(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('vendorId', new ParseIntPipe()) vendorId: number
  ) {
    return this.sbService.getVendor(edfiTenant, vendorId);
  }

  @Put('vendors/:vendorId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.vendor:update',
    subject: {
      id: 'vendorId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async putVendor(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('vendorId', new ParseIntPipe()) vendorId: number,
    @Body() vendor: PutVendorDtoV3
  ) {
    return this.sbService.putVendor(edfiTenant, vendorId, vendor);
  }

  @Post('vendors')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.vendor:create',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async postVendor(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() vendor: PostVendorDtoV3
  ) {
    return this.sbService.postVendor(edfiTenant, vendor);
  }

  @Delete('vendors/:vendorId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.vendor:delete',
    subject: {
      id: 'vendorId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async deleteVendor(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('vendorId', new ParseIntPipe()) vendorId: number
  ) {
    return this.sbService.deleteVendor(edfiTenant, vendorId);
  }

  //
  // Applications
  //

  @Get('applications')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getApplications(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:read')
    validIds: Ids
  ) {
    const allApplications = await this.sbService.getApplications(edfiTenant);

    const integrationProviderApps = await this.integrationAppsTeamService.findAll({
      edfiTenantId,
    });
    const idToAppsMap = new Map<number, GetIntegrationAppDto>();
    integrationProviderApps.forEach((app) => idToAppsMap.set(app.applicationId, app));

    return allApplications
      .filter((application) => this.checkApplicationEdorgsForSafeOperations(application, validIds))
      .map((application) => ({
        // The EdFi application overrides any differences with the Integration App
        ...idToAppsMap.get(application.id),
        ...application,
        id: application.id,
      })) as (GetApplicationDtoV3 & GetIntegrationAppDto)[];
  }

  @Get('applications/:applicationId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getApplication(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:read')
    validIds: Ids
  ) {
    const application = await this.sbService.getApplication(edfiTenant, applicationId);

    if (this.checkApplicationEdorgsForSafeOperations(application, validIds)) {
      try {
        const integrationProviderApp = await this.integrationAppsTeamService.findOne({
          applicationId,
          edfiTenantId,
        });
        return {
          // The EdFi application overrides any differences with the Integration App
          ...integrationProviderApp,
          ...application,
          id: application.id,
        };
      } catch (error) {
        return application;
      }
    } else {
      throw new NotFoundException();
    }
  }

  @Put('applications/:applicationId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:update',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async putApplication(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @Body() application: PutApplicationFormDtoV3,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:update')
    validIds: Ids
  ) {
    let claimset: GetClaimsetSingleDtoV3;
    try {
      claimset = await this.sbService.getClaimset(edfiTenant, application.claimsetId);
    } catch (claimsetNotFound) {
      throw new ValidationHttpException({
        field: 'claimsetId',
        message: 'Cannot retrieve claimset for validation',
      });
    }
    if (claimset._isSystemReserved) {
      throw new ValidationHttpException({
        field: 'claimsetId',
        message: 'Cannot use system-reserved claimset',
      });
    }
    const availableEdorgs = await this.edorgRepository.findBy({
      edfiTenantId: edfiTenant.id,
      educationOrganizationId: In(application.educationOrganizationIds),
      odsInstanceId: application.dataStoreId,
    });
    const odsInstanceId = availableEdorgs[0].odsInstanceId;

    // This checks the existing unchanged version of the application against the valid IDs
    const existingApplication = await this.sbService.getApplication(edfiTenant, applicationId);
    if (!this.checkApplicationEdorgsForUnsafeOperations(existingApplication, validIds)) {
      throw new HttpException('You do not have control of all implicated Ed-Orgs', 403);
    }

    const dto = plainToInstance(PutApplicationDtoV3, {
      ...instanceToPlain(application),
      claimSetName: claimset.name,
      dataStoreIds: [odsInstanceId],
      educationOrganizationIds: availableEdorgs.map((edorg) => edorg.educationOrganizationId),
    });

    if (dto.educationOrganizationIds.length !== availableEdorgs.length) {
      throw new ValidationHttpException({
        field: 'edorgIds',
        message: 'One or more invalid education organization IDs',
      });
    }
    if (
      !availableEdorgs.every((edorg) => edorg.odsInstanceId === availableEdorgs[0].odsInstanceId)
    ) {
      throw new ValidationHttpException({
        field: 'edorgIds',
        message: 'Education organizations not all from the same ODS',
      });
    }

    // This checks the new version of the application against the valid IDs
    if (this.checkApplicationEdorgsForUnsafeOperations(dto, validIds)) {
      const realOds = await this.odsRepository.findOneBy({
        edfiTenantId: edfiTenant.id,
        odsInstanceId,
      });
      const existingIntegrationApp = await this.integrationAppsTeamService.findOne({
        applicationId,
        edfiTenantId,
      });

      if (existingIntegrationApp) {
        // EdFi applications that are Integration Apps are only allowed to update: name, vendor, profile, and claimset
        if (realOds.id !== existingIntegrationApp.odsId) {
          throw new ValidationHttpException({
            field: 'dataStoreId',
            message: 'Cannot change ODS instance for an Integration Application',
          });
        }
        if (dto.integrationProviderId !== existingIntegrationApp.integrationProviderId) {
          throw new ValidationHttpException({
            field: 'integrationProviderId',
            message: 'Cannot change Integration Provider for an Integration Application',
          });
        }

        const realEdorgs = await this.edorgRepository.findBy({
          edfiTenantId: edfiTenant.id,
          educationOrganizationId: In(dto.educationOrganizationIds),
          odsInstanceId,
        });
        const hasChangedAmountOfEdorgs =
          realEdorgs.length !== existingIntegrationApp.edorgIds.length;
        const hasChangedEdorgs = realEdorgs.some(
          (edorg) => !existingIntegrationApp.edorgIds.includes(edorg.id)
        );
        if (hasChangedAmountOfEdorgs || hasChangedEdorgs) {
          throw new ValidationHttpException({
            field: 'educationOrganizationIds',
            message: 'Cannot change Education Organization IDs for an Integration Application',
          });
        }

        // Integration Apps are only allowed to change their name so only update if the name changes
        const hasNewName = dto.applicationName !== existingIntegrationApp.applicationName;
        if (hasNewName) {
          await this.integrationAppsTeamService.update({
            applicationId,
            edfiTenantId,
            applicationName: dto.applicationName,
          });
        }
      }

      // If no Integration App exists and an integrationProviderId is provided, create a new Integration App
      if (!existingIntegrationApp && dto.integrationProviderId) {
        await this.integrationAppsTeamService.create({
          applicationId,
          applicationName: dto.applicationName,
          edfiTenantId: edfiTenant.id,
          edorgIds: availableEdorgs.map((edorg) => edorg.id),
          integrationProviderId: dto.integrationProviderId,
          odsId: realOds.id,
          sbEnvironmentId: edfiTenant.sbEnvironmentId,
        });
      }

      delete dto.integrationProviderId;
      return this.sbService.putApplication(edfiTenant, applicationId, dto);
    } else {
      throw new ValidationHttpException({
        field: 'edorgIds',
        message: 'Not authorized on all education organizations',
      });
    }
  }

  @Post('applications')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:create',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async postApplication(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @Query('returnRaw') returnRaw: boolean | undefined,
    @Body() application: PostApplicationFormDtoV3,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:create')
    validIds: Ids
  ) {
    let claimset: GetClaimsetSingleDtoV3;
    try {
      claimset = await this.sbService.getClaimset(edfiTenant, application.claimsetId);
    } catch (claimsetNotFound) {
      Logger.error(claimsetNotFound);
      throw new BadRequestException('Error trying to use claimset');
    }
    if (claimset._isSystemReserved) {
      throw new ValidationHttpException({
        field: 'claimsetId',
        message: 'Cannot use system-reserved claimset',
      });
    }

    const { educationOrganizationIds, dataStoreId } = application;
    const realEdorgs = await this.edorgRepository.findBy({
      edfiTenantId: edfiTenant.id,
      educationOrganizationId: In(educationOrganizationIds),
      odsInstanceId: dataStoreId,
    });
    if (realEdorgs.length !== educationOrganizationIds.length) {
      throw new ValidationHttpException({
        field: 'educationOrganizationIds',
        message: 'Invalid education organization IDs',
      });
    }

    const dto = plainToInstance(
      PostApplicationDtoV3,
      {
        ...instanceToPlain(application),
        claimSetName: claimset.name,
        dataStoreIds: [dataStoreId],
      },
      { excludeExtraneousValues: true }
    );

    if (!sbEnvironment.domain)
      throw new InternalServerErrorException('Environment config lacks an Ed-Fi hostname.');
    if (this.checkApplicationEdorgsForUnsafeOperations(dto, validIds)) {
      const adminApiResponse = await this.sbService.postApplication(edfiTenant, dto);

      if (application.integrationProviderId) {
        const realOds = await this.odsRepository.findOneBy({
          edfiTenantId: edfiTenant.id,
          odsInstanceId: dataStoreId,
        });
        await this.integrationAppsTeamService.create({
          applicationId: adminApiResponse.id,
          applicationName: application.applicationName,
          edfiTenantId: edfiTenant.id,
          edorgIds: realEdorgs.map((edorg) => edorg.id),
          integrationProviderId: application.integrationProviderId,
          odsId: realOds.id,
          sbEnvironmentId: sbEnvironment.id,
        });
      }
      if (config.USE_YOPASS === true || config.USE_YOPASS === 'true') {
        try {
          const yopassResult = await postYopassSecret({
            ...adminApiResponse,
            url: GetApplicationDtoV3.apiUrl(
              sbEnvironment.startingBlocks,
              sbEnvironment.domain,
              application.applicationName,
              edfiTenant.name
            ),
          });

          return toApplicationYopassResponseDto({
            link: yopassResult.link,
            applicationId: adminApiResponse.id,
            secretSharingMethod: SecretSharingMethod.Yopass,
          });
        } catch (error) {
          Logger.error('Yopass failed for postApplication:', error);
          throw error; // Re-throw the original error
        }
      } else {
        return toPostApplicationResponseDtoV3({
          ...adminApiResponse,
          secretSharingMethod: SecretSharingMethod.Direct,
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
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async deleteApplication(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('applicationId', new ParseIntPipe()) applicationId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:delete')
    validIds: Ids
  ) {
    const application = await this.sbService.getApplication(edfiTenant, applicationId);

    if (this.checkApplicationEdorgsForUnsafeOperations(application, validIds)) {
      this.integrationAppsTeamService.remove({ applicationId, edfiTenantId });
      return this.sbService.deleteApplication(edfiTenant, applicationId);
    } else {
      throw new HttpException('You do not have control of all implicated Ed-Orgs', 403);
    }
  }

  //
  // Api Clients
  //

  @Get('apiclients')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getApiClients(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:read') validIds: Ids,
    @Query('applicationId') applicationId?: number,
  ) {
    if (applicationId === undefined) {
      throw new BadRequestException('Query parameter "applicationId" is required.');
    }

    const allApiClients = await this.sbService.getApiClients(edfiTenant, applicationId);
    return allApiClients.filter((v) => checkId(v.id, validIds));
  }

  @Get('apiclients/:apiclientId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getApiClient(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('apiclientId', new ParseIntPipe()) apiClientId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:read')
    validIds: Ids
  ) {
    if (!checkId(apiClientId, validIds)) {
      throw new NotFoundException();
    }
    return await this.sbService.getApiClient(edfiTenant, apiClientId);
  }

  @Put('apiclients/:apiclientId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:update',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async putApiClient(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('apiclientId', new ParseIntPipe()) apiClientId: number,
    @Body() apiClient: PutApiClientDtoV3,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:update')
    validIds: Ids
  ) {
    if (!checkId(apiClientId, validIds)) {
      throw new NotFoundException();
    }

    const existingApiClient = await this.sbService.getApiClient(edfiTenant, apiClientId);
    if (
      existingApiClient &&
      existingApiClient.applicationId !== apiClient.applicationId
    ) {
      throw new BadRequestException(
        'The applicationId in the request body must match the existing API client applicationId.'
      );
    }

    return await this.sbService.putApiClient(edfiTenant, apiClientId, apiClient);
  }

  @Post('apiclients')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:update',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async postApiClient(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @Body() apiClient: PostApiClientDtoV3,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:update')
    validIds: Ids
  ) {
    const application = await this.sbService.getApplication(edfiTenant, apiClient.applicationId);
    if (!this.checkApplicationEdorgsForUnsafeOperations(application, validIds)) {
      throw new HttpException('You do not have control of all implicated Ed-Orgs', 403);
    }

    const adminApiResponse = await this.sbService.postApiClient(edfiTenant, apiClient);

    if (config.USE_YOPASS === true || config.USE_YOPASS === 'true') {
      try {
        const yopassResult = await postYopassSecret({
          ...adminApiResponse,
          url: GetApiClientDtoV3.apiUrl(
            sbEnvironment.startingBlocks,
            sbEnvironment.domain,
            apiClient.name,
            edfiTenant.name
          ),
        });

        return toApiClientYopassResponseDto({
          link: yopassResult.link,
          apiClientId: adminApiResponse.id,
          secretSharingMethod: SecretSharingMethod.Yopass,
        });
      } catch (error) {
        Logger.error('Yopass failed for postApiClient:', error);
        throw error;
      }
    } else {
      return toPostApiClientResponseDtoV3({
        ...adminApiResponse,
        secretSharingMethod: SecretSharingMethod.Direct,
      });
    }
  }

  @Put('apiclients/:apiclientId/reset-credential')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async resetApiClientCredentials(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @Param('apiclientId', new ParseIntPipe()) apiClientId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials')
    validIds: Ids
  ) {
    const apiClient = await this.sbService.getApiClient(edfiTenant, apiClientId);
    const application = await this.sbService.getApplication(edfiTenant, apiClient.applicationId);

    if (!this.checkApplicationEdorgsForUnsafeOperations(application, validIds)) {
      throw new HttpException('You do not have control of all implicated Ed-Orgs', 403);
    }

    const adminApiResponse = await this.sbService.putApiClientResetCredential(
      edfiTenant,
      apiClientId
    );

    if (config.USE_YOPASS === true || config.USE_YOPASS === 'true') {
      try {
        const yopassResult = await postYopassSecret({
          ...adminApiResponse,
          url: GetApiClientDtoV3.apiUrl(
            sbEnvironment.startingBlocks,
            sbEnvironment.domain,
            application.applicationName,
            edfiTenant.name
          ),
        });

        return toApiClientYopassResponseDto({
          link: yopassResult.link,
          apiClientId: adminApiResponse.id,
          secretSharingMethod: SecretSharingMethod.Yopass,
        });
      } catch (error) {
        Logger.error('Yopass failed for resetApiClientCredentials:', error);
        throw error;
      }
    } else {
      return toPostApiClientResponseDtoV3({
        ...adminApiResponse,
        secretSharingMethod: SecretSharingMethod.Direct,
      });
    }
  }

  @Delete('apiclients/:apiclientId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async deleteApiClient(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('apiclientId', new ParseIntPipe()) apiClientId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg.application:delete')
    validIds: Ids
  ) {
    const apiClient = await this.sbService.getApiClient(edfiTenant, apiClientId);
    const application = await this.sbService.getApplication(edfiTenant, apiClient.applicationId);

    if (!this.checkApplicationEdorgsForUnsafeOperations(application, validIds)) {
      throw new HttpException('You do not have control of all implicated Ed-Orgs', 403);
    }

    return await this.sbService.deleteApiClient(edfiTenant, apiClientId);
  }

  //
  // Claimsets
  //

  @Get('claimsets')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getClaimsets(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @InjectFilter('team.sb-environment.edfi-tenant.claimset:read')
    validIds: Ids
  ) {
    const allClaimsets = await this.sbService.getClaimsets(edfiTenant);
    return allClaimsets.filter((c) => checkId(c.id, validIds));
  }
  @Post('claimsets/export')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async exportClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Query('id') _ids: string[] | string,
    @InjectFilter('team.sb-environment.edfi-tenant.claimset:read') validIds: Ids
  ) {
    if (_ids === undefined) throw new BadRequestException('At least one claimset ID must be provided');
    const ids = Array.isArray(_ids) ? _ids : [_ids];
    const parsedIds = ids.map((id) => {
      const trimmed = id.trim();
      const n = parseInt(trimmed, 10);
      if (isNaN(n) || n <= 0 || n.toString() !== trimmed)
        throw new BadRequestException(`Invalid claimset ID: ${id}`);
      return n;
    });
    for (const id of parsedIds) {
      if (!checkId(id, validIds)) throw new ForbiddenException(`Access denied to claimset ID: ${id}`);
    }
    const claimsets = await Promise.all(
      parsedIds.map((id) => this.sbService.exportClaimset(edfiTenant, id))
    );
    const title =
      claimsets.length === 1 ? claimsets[0].name : `${edfiTenant.sbEnvironment.envLabel} claimsets`;
    const document = {
      title,
      template: {
        claimSets: claimsets.map((c) => ({
          name: c.name,
          resourceClaims: c.resourceClaims,
        })),
      },
    };
    const id = Math.round(Math.random() * 999999999999);
    this.downloadCache.set(id, {
      content: JSON.stringify(document, null, 2),
      title: `${title.replace(/[/\\:*?"<>|]+/g, '_')}_${Number(new Date())}.json`,
    });
    return new Id(id);
  }
  @Get('claimsets/export/:exportId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async downloadExportClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('exportId', new ParseIntPipe()) exportId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Res() res: Response
  ) {
    const cachedItem = this.downloadCache.get<{ content: string; title: string }>(Number(exportId));
    this.downloadCache.del(Number(exportId));
    if (cachedItem === undefined) {
      throw new NotFoundException(
        'Export not found. It may have expired. We hold on to exports for 5 minutes after creation.'
      );
    } else {
      const { content, title } = cachedItem;
      res.setHeader('Content-Disposition', `attachment; filename=${title}`);
      res.setHeader('Content-Type', 'application/json');
      res.send(content);
    }
  }
  @Get('claimsets/:claimsetId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:read',
    subject: {
      id: 'claimsetId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number
  ) {
    return this.sbService.getClaimset(edfiTenant, claimsetId);
  }

  @Put('claimsets/:claimsetId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:update',
    subject: {
      id: 'claimsetId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async putClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number,
    @Body() claimset: PutClaimsetDtoV3
  ) {
    return await this.sbService.putClaimset(edfiTenant, claimsetId, claimset);
  }

  @Post('claimsets')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:create',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async postClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() claimset: PostClaimsetDtoV3
  ) {
    return await this.sbService.postClaimset(edfiTenant, claimset);
  }
  @Post('claimsets/copy')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:create',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async copyClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() claimset: CopyClaimsetDtoV3
  ) {
    try {
      return await this.sbService.copyClaimset(edfiTenant, claimset);
    } catch (PostError: unknown) {
      Logger.error(PostError);
      if (axios.isAxiosError(PostError)) {
        if (isIAdminApiValidationError(PostError.response?.data)) {
          if (PostError.response.data.errors?.Name?.[0]?.includes('this name already exists')) {
            throw new ValidationHttpException({
              field: 'name',
              message: 'A claimset with this name already exists. Please choose a different name.',
            });
          } else {
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
  @Post('claimsets/import')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:create',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async importClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() claimset: ImportClaimsetSingleDtoV3
  ) {
    return this.sbService.importClaimset(edfiTenant, claimset);
  }

  @Delete('claimsets/:claimsetId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.claimset:delete',
    subject: {
      id: 'claimsetId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async deleteClaimset(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('claimsetId', new ParseIntPipe()) claimsetId: number
  ) {
    await this.sbService.deleteClaimset(edfiTenant, claimsetId);
    return undefined;
  }

  //
  // Data Stores (renamed from V2's "Ods Instances")
  //

  @Get('dataStores')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getDataStores(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @InjectFilter('team.sb-environment.edfi-tenant.ods:read')
    validIds: Ids
  ) {
    const allDataStores = await this.sbService.getDataStores(edfiTenant);
    return allDataStores.filter((c) => checkId(c.id, validIds));
  }

  //
  // Profiles
  //

  @Get('profiles')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.profile:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getProfiles(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @InjectFilter('team.sb-environment.edfi-tenant.profile:read')
    validIds: Ids
  ) {
    const allProfiles = await this.sbService.getProfiles(edfiTenant);
    return allProfiles.filter((c) => checkId(c.id, validIds));
  }

  @Get('profiles/:profileId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.profile:read',
    subject: {
      id: 'profileId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async getProfile(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('profileId', new ParseIntPipe()) profileId: number
  ) {
    return this.sbService.getProfile(edfiTenant, profileId);
  }

  @Put('profiles/:profileId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.profile:update',
    subject: {
      id: 'profileId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async putProfile(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('profileId', new ParseIntPipe()) profileId: number,
    @Body() profile: PutProfileDtoV3
  ) {
    {
      try {
        return await this.sbService.putProfile(edfiTenant, profileId, profile);
      } catch (error) {
        if (error.response.data.title === 'Validation failed') {
          const errorDefiniton = error.response.data.errors['Definition'][0];
          throw new HttpException(`Invalid XML format for definition: ${errorDefiniton}`, 500);
        } else {
          throw new HttpException('Error updating profile', 500);
        }
      }
    }
  }

  @Post('profiles')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.profile:create',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async postProfile(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() profile: PostProfileDtoV3
  ) {
    try {
      return await this.sbService.postProfile(edfiTenant, profile);
    } catch (error) {
      if (error.response.data.title === 'Validation failed') {
        const errorDefiniton = error.response.data.errors['Definition'][0];
        throw new HttpException(`Invalid XML format for definition: ${errorDefiniton}`, 500);
      } else {
        throw new HttpException('Error creating profile', 500);
      }
    }
  }

  @Delete('profiles/:profileId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.profile:delete',
    subject: {
      id: 'profileId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async deleteProfile(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('profileId', new ParseIntPipe()) profileId: number
  ) {
    await this.sbService.deleteProfile(edfiTenant, profileId);
    return undefined;
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx nx test api --testFile=admin-api.v3.controller.spec.ts`
Expected: PASS — 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.controller.ts packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.controller.spec.ts
git commit -m "feat: add Admin API V3 controller"
```

### Task 2: Wire `AdminApiModuleV3` into the app

**Files:**
- Create: `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.module.ts`
- Create: `packages/api/src/teams/edfi-tenants/starting-blocks/v3/index.ts`
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/index.ts`
- Modify: `packages/api/src/app/routes.ts`
- Modify: `packages/api/src/app/app.module.ts`
- Modify: `packages/api/src/app/services.module.ts`

There is no dedicated unit test for module wiring in this codebase (V1/V2 modules have none) — correctness here is verified by `npx nx build api` succeeding and the app booting (covered by existing e2e/startup checks, unchanged by this plan). This task has no TDD test-first step; it is pure wiring.

- [ ] **Step 1: Create `AdminApiModuleV3`**

Create `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AdminApiControllerV3 } from './admin-api.v3.controller';

@Module({
  controllers: [AdminApiControllerV3],
})
export class AdminApiModuleV3 {}
```

- [ ] **Step 2: Create the `v3/index.ts` barrel**

Create `packages/api/src/teams/edfi-tenants/starting-blocks/v3/index.ts`:

```typescript
export * from './admin-api-v3-exception.filter';
export * from './admin-api.v3.service';
export * from './admin-api.v3.controller';
export * from './admin-api.v3.module';
```

- [ ] **Step 3: Register the v3 barrel in the parent `starting-blocks/index.ts`**

The file currently reads exactly:

```typescript
export * from './v1';
export * from './v2';
```

Edit it to:

```typescript
export * from './v1';
export * from './v2';
export * from './v3';
```

- [ ] **Step 4: Register the route in `routes.ts`**

In `packages/api/src/app/routes.ts`, add the import:

```typescript
import { AdminApiModuleV3 } from '../teams/edfi-tenants/starting-blocks/v3/admin-api.v3.module';
```

directly after the existing `AdminApiModuleV2` import line. Then, in the `routes` array, find this block (inside the `/teams` path's `children`):

```typescript
      {
        path: '/:teamId/edfi-tenants/:edfiTenantId/admin-api/v2',
        module: AdminApiModuleV2,
      },
```

and add a sibling entry directly after it:

```typescript
      {
        path: '/:teamId/edfi-tenants/:edfiTenantId/admin-api/v2',
        module: AdminApiModuleV2,
      },
      {
        path: '/:teamId/edfi-tenants/:edfiTenantId/admin-api/v3',
        module: AdminApiModuleV3,
      },
```

- [ ] **Step 5: Register the module in `app.module.ts`**

In `packages/api/src/app/app.module.ts`, add the import directly after the existing `AdminApiModuleV2` import:

```typescript
import { AdminApiModuleV3 } from '../teams/edfi-tenants/starting-blocks/v3/admin-api.v3.module';
```

Then, in the `@Module({ imports: [...] })` array, find:

```typescript
    AdminApiModuleV1,
    AdminApiModuleV2,
```

and add a sibling entry directly after it:

```typescript
    AdminApiModuleV1,
    AdminApiModuleV2,
    AdminApiModuleV3,
```

- [ ] **Step 6: Register `AdminApiServiceV3` as a global provider in `services.module.ts`**

`AdminApiControllerV3` depends on `AdminApiServiceV3` via constructor injection, but `AdminApiModuleV3` (mirroring `AdminApiModuleV2`) declares no `providers` of its own — `AdminApiServiceV2` is actually made available application-wide via the `@Global()` `ServicesModule`. `AdminApiServiceV3` needs the same registration or DI will fail at boot with a "Nest can't resolve dependencies" error.

In `packages/api/src/app/services.module.ts`, change:

```typescript
import {
  AdminApiServiceV1,
  StartingBlocksServiceV2,
  StartingBlocksServiceV1,
  AdminApiServiceV2,
} from '../teams/edfi-tenants/starting-blocks';
```

to:

```typescript
import {
  AdminApiServiceV1,
  StartingBlocksServiceV2,
  StartingBlocksServiceV1,
  AdminApiServiceV2,
  AdminApiServiceV3,
} from '../teams/edfi-tenants/starting-blocks';
```

Then change the `providers` array from:

```typescript
const providers = [
  AdminApiServiceV1,
  AdminApiServiceV2,
  AdminApiSyncService,
```

to:

```typescript
const providers = [
  AdminApiServiceV1,
  AdminApiServiceV2,
  AdminApiServiceV3,
  AdminApiSyncService,
```

- [ ] **Step 7: Build to verify the whole app still compiles and boots correctly**

Run: `npx nx build api`
Expected: build succeeds with no TypeScript errors (in particular, no "cannot find module './v3'" or missing-export errors from the barrel changes).

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.module.ts packages/api/src/teams/edfi-tenants/starting-blocks/v3/index.ts packages/api/src/teams/edfi-tenants/starting-blocks/index.ts packages/api/src/app/routes.ts packages/api/src/app/app.module.ts packages/api/src/app/services.module.ts
git commit -m "feat: register Admin API V3 module and routes"
```

### Task 3: Fix the credential-saving gap for `v3` environments

**Files:**
- Modify: `packages/api/src/sb-environments-global/sb-environments-global.service.ts`
- Create: `packages/api/src/sb-environments-global/sb-environments-global.service.spec.ts`

`SbEnvironmentsGlobalService.updateAdminApi()` currently throws a `CustomHttpException` for any `sbEnvironment.version` other than `'v1'`/`'v2'` when a user tries to save/update Admin API credentials for a tenant. Since `v3` is a real, already-modeled `SbaaAdminApiVersion` value (see `packages/models/src/interfaces/sb-environment.interface.ts`), and `StartingBlocksServiceV2.saveAdminApiCredentials()` only touches the generic `{ tenants, adminApiSecret }` shape (which `ISbEnvironmentConfigPublicV3`/`ISbEnvironmentConfigPrivateV2` already match byte-for-byte), this method can be reused as-is for `v3` — no new service class needed.

There is no pre-existing spec file for `SbEnvironmentsGlobalService`, so this task creates one, scoped to `updateAdminApi()`'s version-branching behavior (the specific area this task changes), rather than covering the whole class.

- [ ] **Step 1: Write the failing spec**

Create `packages/api/src/sb-environments-global/sb-environments-global.service.spec.ts`:

```typescript
import 'reflect-metadata';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { SbEnvironmentsGlobalService } from './sb-environments-global.service';

describe('SbEnvironmentsGlobalService - updateAdminApi', () => {
  let service: SbEnvironmentsGlobalService;
  let mockRepository: { save: jest.Mock };
  let mockAdminApiServiceV1: any;
  let mockStartingBlocksServiceV1: { saveAdminApiCredentials: jest.Mock };
  let mockStartingBlocksServiceV2: { saveAdminApiCredentials: jest.Mock };
  let mockEdfiTenantService: { pingAdminApi: jest.Mock };

  const updateDto = {
    adminKey: 'key',
    adminSecret: 'secret',
    url: 'https://api.test.com',
    modifiedById: 1,
  };

  beforeEach(() => {
    mockRepository = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };
    mockAdminApiServiceV1 = {};
    mockStartingBlocksServiceV1 = { saveAdminApiCredentials: jest.fn().mockResolvedValue(undefined) };
    mockStartingBlocksServiceV2 = { saveAdminApiCredentials: jest.fn().mockResolvedValue(undefined) };
    mockEdfiTenantService = {
      pingAdminApi: jest.fn().mockResolvedValue(undefined),
    };

    service = new SbEnvironmentsGlobalService(
      mockRepository as any,
      mockAdminApiServiceV1,
      mockStartingBlocksServiceV1 as any,
      mockStartingBlocksServiceV2 as any,
      mockEdfiTenantService as any
    );
  });

  it('reuses StartingBlocksServiceV2.saveAdminApiCredentials for v3 environments', async () => {
    const sbEnvironment = { version: 'v3' } as SbEnvironment;
    const edfiTenant = { sbEnvironmentId: 1 } as EdfiTenant;

    await service.updateAdminApi(sbEnvironment, edfiTenant, updateDto as any);

    expect(mockStartingBlocksServiceV2.saveAdminApiCredentials).toHaveBeenCalledWith(
      edfiTenant,
      sbEnvironment,
      { ClientId: 'key', ClientSecret: 'secret', url: 'https://api.test.com' }
    );
    expect(mockStartingBlocksServiceV1.saveAdminApiCredentials).not.toHaveBeenCalled();
  });

  it('still uses StartingBlocksServiceV2.saveAdminApiCredentials for v2 environments (unchanged)', async () => {
    const sbEnvironment = { version: 'v2' } as SbEnvironment;
    const edfiTenant = { sbEnvironmentId: 1 } as EdfiTenant;

    await service.updateAdminApi(sbEnvironment, edfiTenant, updateDto as any);

    expect(mockStartingBlocksServiceV2.saveAdminApiCredentials).toHaveBeenCalledWith(
      edfiTenant,
      sbEnvironment,
      { ClientId: 'key', ClientSecret: 'secret', url: 'https://api.test.com' }
    );
  });

  it('still throws for an unrecognized version (unchanged)', async () => {
    const sbEnvironment = { version: undefined } as unknown as SbEnvironment;
    const edfiTenant = { sbEnvironmentId: 1 } as EdfiTenant;

    await expect(
      service.updateAdminApi(sbEnvironment, edfiTenant, updateDto as any)
    ).rejects.toThrow('Cannot save credentials.');
  });
});
```

- [ ] **Step 2: Run the spec to verify the `v3` case fails**

Run: `npx nx test api --testFile=sb-environments-global.service.spec.ts`
Expected: FAIL on the first test (`reuses StartingBlocksServiceV2...for v3 environments`) — the current `updateAdminApi()` throws `CustomHttpException('Cannot save credentials.', ...)` for `version: 'v3'` instead of calling `saveAdminApiCredentials`.

- [ ] **Step 3: Add the `v3` branch**

In `packages/api/src/sb-environments-global/sb-environments-global.service.ts`, change:

```typescript
    if (sbEnvironment.version === 'v2') {
      await this.startingBlocksServiceV2.saveAdminApiCredentials(
        edfiTenant,
        sbEnvironment,
        credentials
      );
    } else if (sbEnvironment.version === 'v1') {
      await this.startingBlocksServiceV1.saveAdminApiCredentials(sbEnvironment, credentials);
    } else {
```

to:

```typescript
    if (sbEnvironment.version === 'v2' || sbEnvironment.version === 'v3') {
      await this.startingBlocksServiceV2.saveAdminApiCredentials(
        edfiTenant,
        sbEnvironment,
        credentials
      );
    } else if (sbEnvironment.version === 'v1') {
      await this.startingBlocksServiceV1.saveAdminApiCredentials(sbEnvironment, credentials);
    } else {
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx nx test api --testFile=sb-environments-global.service.spec.ts`
Expected: PASS — 3 passing tests.

- [ ] **Step 5: Build the api package**

Run: `npx nx build api`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/sb-environments-global/sb-environments-global.service.ts packages/api/src/sb-environments-global/sb-environments-global.service.spec.ts
git commit -m "fix: allow saving Admin API credentials for v3 environments"
```

### Task 4: Full verification pass

- [ ] **Step 1: Run the full API test suite**

Run: `npx nx test api`
Expected: all tests pass, including every V1/V2 spec (unchanged) plus all new V3 specs from Phases 2–4.

- [ ] **Step 2: Run the full models test suite**

Run: `npx nx test models`
Expected: all tests pass, including the new `edfi-admin-api.v3.dto.spec.ts` from Phase 1.

- [ ] **Step 3: Build both packages**

Run: `npx nx build models && npx nx build api`
Expected: both builds succeed with no TypeScript errors.

- [ ] **Step 4: Run lint**

Run: `npm run lint:check`
Expected: no new lint errors introduced by any file created/modified in this plan.

- [ ] **Step 5: Commit** (only if lint required auto-fixable changes; skip if step 4 was already clean)

```bash
git add -A
git commit -m "chore: lint fixes for Admin API V3 support"
```
