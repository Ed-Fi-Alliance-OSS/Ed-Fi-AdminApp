import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Ids } from '@edanalytics/models';
import { AdminApiControllerV3 } from './admin-api.v3.controller';
import { CustomHttpException, ValidationHttpException } from '../../../../utils';
import { ENV_SYNC_CHNL } from '../../../../sb-sync/sb-sync.module';

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
      null as any,
      null as any,
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
      null as any,
      null as any,
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

  const mockEdfiTenant: any = {
    id: 1,
    sbEnvironment: { envLabel: 'Test Env' },
  };

  const mockProfile: any = { name: 'Test Profile', definition: '<Profile />' };

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
      null as any,
      mockSbService as any,
      null as any,
      null as any,
      null as any,
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

describe('AdminApiControllerV3 - postInstance', () => {
  let controller: AdminApiControllerV3;
  let mockSbService: { postInstance: jest.Mock };
  let mockOdsRepository: { save: jest.Mock };
  let mockJobQueue: { send: jest.Mock };

  const mockEdfiTenant: any = { id: 1, sbEnvironment: { envLabel: 'Test Env' } };
  const mockInstance: any = { name: 'My DB Instance', databaseTemplate: 'Minimal' };
  const makeAxiosError = (data: unknown) => ({
    isAxiosError: true,
    message: 'Request failed with status code 400',
    response: { status: 400, data },
  });

  beforeEach(() => {
    mockSbService = { postInstance: jest.fn() };
    mockOdsRepository = { save: jest.fn() };
    mockJobQueue = { send: jest.fn() };
    controller = new AdminApiControllerV3(
      null as any,
      mockSbService as any,
      null as any,
      mockOdsRepository as any,
      mockJobQueue as any,
    );
  });

  it('creates local ODS row and enqueues sync after instance creation', async () => {
    mockSbService.postInstance.mockResolvedValue({ id: 55 });
    mockOdsRepository.save.mockResolvedValue({ id: 901 });
    mockJobQueue.send.mockResolvedValue('job-123');

    await expect(controller.postInstance(1, 1, mockEdfiTenant, mockInstance)).resolves.toEqual({
      id: 901,
    });
    expect(mockSbService.postInstance).toHaveBeenCalledWith(mockEdfiTenant, mockInstance);
    expect(mockOdsRepository.save).toHaveBeenCalledWith({
      edfiTenantId: mockEdfiTenant.id,
      sbEnvironmentId: mockEdfiTenant.sbEnvironmentId,
      odsInstanceId: 55,
      dbName: mockInstance.name,
      odsInstanceName: mockInstance.name,
      instanceType: mockInstance.databaseTemplate,
      databaseTemplate: mockInstance.databaseTemplate,
      status: 'PendingCreate',
    });
    expect(mockJobQueue.send).toHaveBeenCalledWith(
      ENV_SYNC_CHNL,
      { sbEnvironmentId: mockEdfiTenant.sbEnvironmentId },
      { expireInHours: 2 }
    );
  });

  it('throws ValidationHttpException for name validation errors', async () => {
    mockSbService.postInstance.mockRejectedValue(
      makeAxiosError({ title: 'Validation failed', status: 400, errors: { Name: ['name is required'] } })
    );
    await expect(controller.postInstance(1, 1, mockEdfiTenant, mockInstance)).rejects.toThrow(
      new ValidationHttpException({ field: 'name', message: 'name is required' })
    );
  });

  it('throws ValidationHttpException for databaseTemplate validation errors', async () => {
    mockSbService.postInstance.mockRejectedValue(
      makeAxiosError({ title: 'Validation failed', status: 400, errors: { DatabaseTemplate: ['database template is required'] } })
    );
    await expect(controller.postInstance(1, 1, mockEdfiTenant, mockInstance)).rejects.toThrow(
      new ValidationHttpException({ field: 'databaseTemplate', message: 'database template is required' })
    );
  });

  it('throws CustomHttpException for other validation errors', async () => {
    const errorData = { title: 'Validation failed', status: 400, errors: { Other: ['something else went wrong'] } };
    mockSbService.postInstance.mockRejectedValue(makeAxiosError(errorData));
    await expect(controller.postInstance(1, 1, mockEdfiTenant, mockInstance)).rejects.toThrow(
      new CustomHttpException({ title: 'Validation error', type: 'Error', data: errorData }, 400)
    );
  });

  it('rethrows non-validation errors', async () => {
    const otherError = new Error('boom');
    mockSbService.postInstance.mockRejectedValue(otherError);
    await expect(controller.postInstance(1, 1, mockEdfiTenant, mockInstance)).rejects.toThrow(otherError);
  });
});

describe('AdminApiControllerV3 - deleteInstance', () => {
  let controller: AdminApiControllerV3;
  let mockSbService: { deleteInstance: jest.Mock };
  let mockOdsRepository: { findOneBy: jest.Mock; save: jest.Mock };
  let mockJobQueue: { send: jest.Mock };

  const mockEdfiTenant: any = { id: 1, sbEnvironmentId: 2, sbEnvironment: { envLabel: 'Test Env' } };

  beforeEach(() => {
    mockSbService = { deleteInstance: jest.fn().mockResolvedValue(undefined) };
    mockOdsRepository = {
      findOneBy: jest.fn().mockResolvedValue({ id: 901, instanceManageId: 55, status: 'Created' }),
      save: jest.fn().mockResolvedValue({ id: 901, instanceManageId: 55, status: 'PendingDelete' }),
    };
    mockJobQueue = { send: jest.fn().mockResolvedValue('job-123') };
    controller = new AdminApiControllerV3(
      null as any,
      mockSbService as any,
      null as any,
      mockOdsRepository as any,
      mockJobQueue as any,
    );
  });

  it('finds local ODS, calls sbService delete, sets PendingDelete, and enqueues sync', async () => {
    const instanceManageId = 55;
    await expect(controller.deleteInstance(1, 1, mockEdfiTenant, instanceManageId)).resolves.toBeUndefined();
    expect(mockOdsRepository.findOneBy).toHaveBeenCalledWith({ edfiTenantId: mockEdfiTenant.id, instanceManageId });
    expect(mockSbService.deleteInstance).toHaveBeenCalledWith(mockEdfiTenant, instanceManageId);
    expect(mockOdsRepository.save).toHaveBeenCalledWith({ id: 901, instanceManageId: 55, status: 'PendingDelete' });
    expect(mockJobQueue.send).toHaveBeenCalledWith(
      ENV_SYNC_CHNL,
      { sbEnvironmentId: mockEdfiTenant.sbEnvironmentId },
      { expireInHours: 2 }
    );
  });

  it('throws BadRequestException when instanceManageId <= 0', async () => {
    await expect(controller.deleteInstance(1, 1, mockEdfiTenant, 0)).rejects.toThrow(
      new BadRequestException('instanceManageId must be greater than zero')
    );
    expect(mockOdsRepository.findOneBy).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when local ODS is not found', async () => {
    mockOdsRepository.findOneBy.mockResolvedValue(null);
    await expect(controller.deleteInstance(1, 1, mockEdfiTenant, 55)).rejects.toThrow(
      new NotFoundException('ODS not found for instanceManageId')
    );
    expect(mockSbService.deleteInstance).not.toHaveBeenCalled();
  });

  it("throws BadRequestException when the local ODS is not in 'Created' status", async () => {
    mockOdsRepository.findOneBy.mockResolvedValue({ id: 901, instanceManageId: 55, status: 'PendingDelete' });
    await expect(controller.deleteInstance(1, 1, mockEdfiTenant, 55)).rejects.toThrow(
      new BadRequestException("ODS must be in 'Created' status to delete by instanceManageId")
    );
    expect(mockSbService.deleteInstance).not.toHaveBeenCalled();
  });
});
