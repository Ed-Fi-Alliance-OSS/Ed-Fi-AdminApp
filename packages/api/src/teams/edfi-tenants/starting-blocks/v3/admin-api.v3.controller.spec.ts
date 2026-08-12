import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Edorg, EdfiTenant, Ods } from '@edanalytics/models-server';
import { Ids, PostProfileDtoV3 } from '@edanalytics/models';
import { Repository } from 'typeorm';
import { AdminApiControllerV3 } from './admin-api.v3.controller';
import { AdminApiServiceV3 } from './admin-api.v3.service';
import { CustomHttpException, ValidationHttpException } from '../../../../utils';
import { IntegrationAppsTeamService } from '../../../../integration-apps-team/integration-apps-team.service';

describe('AdminApiControllerV3 - exportClaimset', () => {
  let controller: AdminApiControllerV3;
  let mockSbService: { exportClaimset: jest.Mock };

  const mockEdfiTenant = {
    id: 1,
    sbEnvironment: { envLabel: 'Test Env' },
  } as unknown as EdfiTenant;

  beforeEach(() => {
    mockSbService = {
      exportClaimset: jest.fn().mockResolvedValue({
        name: 'Test Claimset',
        resourceClaims: [],
      }),
    };
    controller = new AdminApiControllerV3(
      null as unknown as IntegrationAppsTeamService,
      mockSbService as unknown as AdminApiServiceV3,
      null as unknown as Repository<Edorg>,
      null as unknown as Repository<Ods>,
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
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds),
    ).rejects.toThrow(new ForbiddenException('Access denied to claimset ID: 2'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a non-integer string ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['abc'], validIds),
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: abc'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when no id is provided (undefined)', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, undefined, validIds),
    ).rejects.toThrow(new BadRequestException('At least one claimset ID must be provided'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });
});

describe('AdminApiControllerV3 - getDataStores', () => {
  let controller: AdminApiControllerV3;
  let mockSbService: { getDataStores: jest.Mock };

  const mockEdfiTenant = { id: 1 } as unknown as EdfiTenant;

  beforeEach(() => {
    mockSbService = {
      getDataStores: jest.fn().mockResolvedValue([
        { id: 1, name: 'Ods1', dataStoreType: 'Ods' },
        { id: 2, name: 'Ods2', dataStoreType: 'Ods' },
      ]),
    };
    controller = new AdminApiControllerV3(
      null as unknown as IntegrationAppsTeamService,
      mockSbService as unknown as AdminApiServiceV3,
      null as unknown as Repository<Edorg>,
      null as unknown as Repository<Ods>,
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

describe('AdminApiControllerV3 - postProfile', () => {
  let controller: AdminApiControllerV3;
  let mockSbService: { postProfile: jest.Mock };

  const mockEdfiTenant = {
    id: 1,
    sbEnvironment: { envLabel: 'Test Env' },
  } as unknown as EdfiTenant;

  const mockProfile: PostProfileDtoV3 = { name: 'Test Profile', definition: '<Profile />' };

  const makeAxiosError = (data: unknown) => ({
    isAxiosError: true,
    message: 'Request failed with status code 400',
    response: { status: 400, data },
  });

  beforeEach(() => {
    mockSbService = {
      postProfile: jest.fn(),
    };
    controller = new AdminApiControllerV3(
      null as unknown as IntegrationAppsTeamService,
      mockSbService as unknown as AdminApiServiceV3,
      null as unknown as Repository<Edorg>,
      null as unknown as Repository<Ods>,
    );
  });

  it('throws ValidationHttpException for a duplicate profile name', async () => {
    mockSbService.postProfile.mockRejectedValue(
      makeAxiosError({
        title: 'Validation failed',
        status: 400,
        errors: { Name: ['this name already exists'] },
      }),
    );

    await expect(controller.postProfile(1, 1, mockEdfiTenant, mockProfile)).rejects.toThrow(
      new ValidationHttpException({
        field: 'name',
        message: 'A profile with this name already exists. Please choose a different name.',
      }),
    );
  });

  it('throws ValidationHttpException for an invalid XML definition', async () => {
    const definitionError = 'List of possible elements expected: Foo.';
    mockSbService.postProfile.mockRejectedValue(
      makeAxiosError({
        title: 'Validation failed',
        status: 400,
        errors: { Definition: [definitionError] },
      }),
    );

    await expect(controller.postProfile(1, 1, mockEdfiTenant, mockProfile)).rejects.toThrow(
      new ValidationHttpException({
        field: 'definition',
        message: `Invalid XML format for definition: ${definitionError}`,
      }),
    );
  });

  it('throws CustomHttpException for a generic validation error', async () => {
    const errorData = {
      title: 'Validation failed',
      status: 400,
      errors: { Other: ['something else went wrong'] },
    };
    mockSbService.postProfile.mockRejectedValue(makeAxiosError(errorData));

    await expect(controller.postProfile(1, 1, mockEdfiTenant, mockProfile)).rejects.toThrow(
      new CustomHttpException(
        {
          title: 'Validation error',
          type: 'Error',
          data: errorData,
        },
        400,
      ),
    );
  });

  it('rethrows the original error when it is not an axios validation error', async () => {
    const otherError = new Error('boom');
    mockSbService.postProfile.mockRejectedValue(otherError);

    await expect(controller.postProfile(1, 1, mockEdfiTenant, mockProfile)).rejects.toThrow(
      otherError,
    );
  });
});
