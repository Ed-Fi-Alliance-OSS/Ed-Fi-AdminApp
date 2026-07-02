import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Ids } from '@edanalytics/models';
import { AdminApiControllerV2 } from './admin-api.v2.controller';

describe('AdminApiControllerV2 - exportClaimset', () => {
  let controller: AdminApiControllerV2;
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
    controller = new AdminApiControllerV2(
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
