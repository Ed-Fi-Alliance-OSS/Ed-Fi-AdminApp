import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Ids } from '@edanalytics/models';
import { AdminApiControllerV2 } from './admin-api.v2.controller';
import { CustomHttpException, ValidationHttpException } from '../../../../utils';
import { ENV_SYNC_CHNL } from '../../../../sb-sync/sb-sync.module';

describe('AdminApiControllerV2 - exportClaimset', () => {
  let controller: AdminApiControllerV2;
  let mockSbService: { exportClaimset: jest.Mock };

  const mockEdfiTenant: any = {
    id: 1,
    sbEnvironmentId: 2,
    sbEnvironment: { envLabel: 'Test Env' },
  };

  beforeEach(() => {
    mockSbService = {
      exportClaimset: jest.fn().mockResolvedValue({
        name: 'Test Claimset',
        resourceClaims: [],
      }),
    };
    controller = new AdminApiControllerV2(
      null as any,
      mockSbService as any,
      null as any,
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

  it('exports claimsets when all requested IDs are in the authorized set', async () => {
    const validIds: Ids = new Set([1, 2]);
    const result = await controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds);
    expect(mockSbService.exportClaimset).toHaveBeenCalledTimes(2);
    expect(result).toBeDefined();
  });

  it('throws ForbiddenException when one requested ID is outside the authorized set', async () => {
    const validIds: Ids = new Set([1]);
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds)
    ).rejects.toThrow(new ForbiddenException('Access denied to claimset ID: 2'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when the authorized set is empty', async () => {
    const validIds: Ids = new Set<number>();
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1'], validIds)
    ).rejects.toThrow(new ForbiddenException('Access denied to claimset ID: 1'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for an empty-string ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, [''], validIds)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: '));
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

  it('throws BadRequestException for a zero ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['0'], validIds)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: 0'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a negative ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['-1'], validIds)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: -1'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a decimal ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1.5'], validIds)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: 1.5'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when one ID in a mixed array is invalid', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1', 'abc', '3'], validIds)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: abc'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });
});

describe('AdminApiControllerV2 - postProfile', () => {
  let controller: AdminApiControllerV2;
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
    controller = new AdminApiControllerV2(
      null as any,
      mockSbService as any,
      null as any,
      null as any,
      null as any
    );
  });

  it('throws ValidationHttpException for a duplicate profile name', async () => {
    mockSbService.postProfile.mockRejectedValue(
      makeAxiosError({
        title: 'Validation failed',
        status: 400,
        errors: { Name: ['this name already exists'] },
      })
    );

    await expect(controller.postProfile(1, 1, mockEdfiTenant, mockProfile)).rejects.toThrow(
      new ValidationHttpException({
        field: 'name',
        message: 'A profile with this name already exists. Please choose a different name.',
      })
    );
  });

  it('throws ValidationHttpException for an invalid XML definition', async () => {
    const definitionError = 'List of possible elements expected: Foo.';
    mockSbService.postProfile.mockRejectedValue(
      makeAxiosError({
        title: 'Validation failed',
        status: 400,
        errors: { Definition: [definitionError] },
      })
    );

    await expect(controller.postProfile(1, 1, mockEdfiTenant, mockProfile)).rejects.toThrow(
      new ValidationHttpException({
        field: 'definition',
        message: `Invalid XML format for definition: ${definitionError}`,
      })
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
        400
      )
    );
  });

  it('rethrows the original error when it is not an axios validation error', async () => {
    const otherError = new Error('boom');
    mockSbService.postProfile.mockRejectedValue(otherError);

    await expect(controller.postProfile(1, 1, mockEdfiTenant, mockProfile)).rejects.toThrow(
      otherError
    );
  });
});

describe('AdminApiControllerV2 - postDbInstance', () => {
  let controller: AdminApiControllerV2;
  let mockSbService: { postDbInstance: jest.Mock };
  let mockOdsRepository: { save: jest.Mock };
  let mockJobQueue: { send: jest.Mock };

  const mockEdfiTenant: any = {
    id: 1,
    sbEnvironment: { envLabel: 'Test Env' },
  };

  const mockDbInstance: any = { name: 'My DB Instance', databaseTemplate: 'Minimal' };

  const makeAxiosError = (data: unknown) => ({
    isAxiosError: true,
    message: 'Request failed with status code 400',
    response: { status: 400, data },
  });

  beforeEach(() => {
    mockSbService = {
      postDbInstance: jest.fn(),
    };
    mockOdsRepository = {
      save: jest.fn(),
    };
    mockJobQueue = {
      send: jest.fn(),
    };
    controller = new AdminApiControllerV2(
      null as any,
      mockSbService as any,
      null as any,
      mockOdsRepository as any,
      mockJobQueue as any
    );
  });

  it('creates local ODS row and enqueues sync after dbInstance creation', async () => {
    mockSbService.postDbInstance.mockResolvedValue({ id: 55 });
    mockOdsRepository.save.mockResolvedValue({ id: 901 });
    mockJobQueue.send.mockResolvedValue('job-123');

    await expect(controller.postDbInstance(1, 1, mockEdfiTenant, mockDbInstance)).resolves.toEqual({
      id: 901,
    });
    expect(mockSbService.postDbInstance).toHaveBeenCalledWith(mockEdfiTenant, mockDbInstance);
    expect(mockOdsRepository.save).toHaveBeenCalledWith({
      edfiTenantId: mockEdfiTenant.id,
      sbEnvironmentId: mockEdfiTenant.sbEnvironmentId,
      odsInstanceId: 55,
      dbName: mockDbInstance.name,
      odsInstanceName: mockDbInstance.name,
      instanceType: mockDbInstance.databaseTemplate,
      databaseTemplate: mockDbInstance.databaseTemplate,
      status: 'PendingCreate',
    });
    expect(mockJobQueue.send).toHaveBeenCalledWith(
      ENV_SYNC_CHNL,
      { sbEnvironmentId: mockEdfiTenant.sbEnvironmentId },
      { expireInHours: 2 }
    );
  });

  it('throws ValidationHttpException for name validation errors', async () => {
    mockSbService.postDbInstance.mockRejectedValue(
      makeAxiosError({
        title: 'Validation failed',
        status: 400,
        errors: { Name: ['name is required'] },
      })
    );

    await expect(controller.postDbInstance(1, 1, mockEdfiTenant, mockDbInstance)).rejects.toThrow(
      new ValidationHttpException({
        field: 'name',
        message: 'name is required',
      })
    );
  });

  it('throws ValidationHttpException for databaseTemplate validation errors', async () => {
    mockSbService.postDbInstance.mockRejectedValue(
      makeAxiosError({
        title: 'Validation failed',
        status: 400,
        errors: { DatabaseTemplate: ['database template is required'] },
      })
    );

    await expect(controller.postDbInstance(1, 1, mockEdfiTenant, mockDbInstance)).rejects.toThrow(
      new ValidationHttpException({
        field: 'databaseTemplate',
        message: 'database template is required',
      })
    );
  });

  it('throws CustomHttpException for other validation errors', async () => {
    const errorData = {
      title: 'Validation failed',
      status: 400,
      errors: { Other: ['something else went wrong'] },
    };
    mockSbService.postDbInstance.mockRejectedValue(makeAxiosError(errorData));

    await expect(controller.postDbInstance(1, 1, mockEdfiTenant, mockDbInstance)).rejects.toThrow(
      new CustomHttpException(
        {
          title: 'Validation error',
          type: 'Error',
          data: errorData,
        },
        400
      )
    );
  });

  it('rethrows non-validation errors', async () => {
    const otherError = new Error('boom');
    mockSbService.postDbInstance.mockRejectedValue(otherError);

    await expect(controller.postDbInstance(1, 1, mockEdfiTenant, mockDbInstance)).rejects.toThrow(
      otherError
    );
  });
});

describe('AdminApiControllerV2 - deleteDbInstance', () => {
  let controller: AdminApiControllerV2;
  let mockSbService: { deleteDbInstance: jest.Mock };
  let mockOdsRepository: { findOneBy: jest.Mock; save: jest.Mock };
  let mockJobQueue: { send: jest.Mock };

  const mockEdfiTenant: any = {
    id: 1,
    sbEnvironmentId: 2,
    sbEnvironment: { envLabel: 'Test Env' },
  };

  beforeEach(() => {
    mockSbService = {
      deleteDbInstance: jest.fn().mockResolvedValue(undefined),
    };
    mockOdsRepository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 901,
        dbInstanceId: 55,
        status: 'Active',
      }),
      save: jest.fn().mockResolvedValue({
        id: 901,
        dbInstanceId: 55,
        status: 'PendingDelete',
      }),
    };
    mockJobQueue = {
      send: jest.fn().mockResolvedValue('job-123'),
    };
    controller = new AdminApiControllerV2(
      null as any,
      mockSbService as any,
      null as any,
      mockOdsRepository as any,
      mockJobQueue as any
    );
  });

  it('finds local ODS, sets PendingDelete, calls sbService delete, and enqueues sync', async () => {
    const dbInstanceId = 55;

    await expect(controller.deleteDbInstance(1, 1, mockEdfiTenant, dbInstanceId)).resolves.toBeUndefined();

    expect(mockOdsRepository.findOneBy).toHaveBeenCalledWith({
      edfiTenantId: mockEdfiTenant.id,
      dbInstanceId,
    });
    expect(mockOdsRepository.save).toHaveBeenCalledWith({
      id: 901,
      dbInstanceId: 55,
      status: 'PendingDelete',
    });
    expect(mockSbService.deleteDbInstance).toHaveBeenCalledWith(mockEdfiTenant, dbInstanceId);
    expect(mockJobQueue.send).toHaveBeenCalledWith(
      ENV_SYNC_CHNL,
      { sbEnvironmentId: mockEdfiTenant.sbEnvironmentId },
      { expireInHours: 2 }
    );
  });
});
