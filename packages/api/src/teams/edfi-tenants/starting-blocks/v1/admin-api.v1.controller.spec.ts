import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Ids } from '@edanalytics/models';
import { AdminApiControllerV1 } from './admin-api.v1.controller';

describe('AdminApiControllerV1 - exportClaimset', () => {
  let controller: AdminApiControllerV1;
  let mockSbService: { getClaimsetRaw: jest.Mock };

  const mockEdfiTenant: any = {
    id: 1,
    sbEnvironment: { envLabel: 'Test Env' },
  };

  const mockRes: any = {
    setHeader: jest.fn(),
    send: jest.fn(),
  };

  beforeEach(() => {
    mockSbService = {
      getClaimsetRaw: jest.fn().mockResolvedValue({
        name: 'Test Claimset',
        resourceClaims: {},
      }),
    };
    controller = new AdminApiControllerV1(
      mockSbService as any,
      null as any,
      null as any
    );
    mockRes.setHeader.mockClear();
    mockRes.send.mockClear();
  });

  it('exports claimsets when validIds is true (superuser access)', async () => {
    const validIds: Ids = true;
    await controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds, mockRes);
    expect(mockSbService.getClaimsetRaw).toHaveBeenCalledTimes(2);
    expect(mockSbService.getClaimsetRaw).toHaveBeenCalledWith(mockEdfiTenant, 1);
    expect(mockSbService.getClaimsetRaw).toHaveBeenCalledWith(mockEdfiTenant, 2);
    expect(mockRes.send).toHaveBeenCalled();
  });

  it('exports claimsets when all requested IDs are in the authorized set', async () => {
    const validIds: Ids = new Set([1, 2]);
    await controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds, mockRes);
    expect(mockSbService.getClaimsetRaw).toHaveBeenCalledTimes(2);
    expect(mockRes.send).toHaveBeenCalled();
  });

  it('throws ForbiddenException when one requested ID is outside the authorized set', async () => {
    const validIds: Ids = new Set([1]);
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds, mockRes)
    ).rejects.toThrow(new ForbiddenException('Access denied to claimset ID: 2'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when the authorized set is empty', async () => {
    const validIds: Ids = new Set<number>();
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1'], validIds, mockRes)
    ).rejects.toThrow(new ForbiddenException('Access denied to claimset ID: 1'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for an empty-string ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, [''], validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: '));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a non-integer string ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['abc'], validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: abc'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when no id is provided (undefined)', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, undefined, validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('At least one claimset ID must be provided'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a zero ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['0'], validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: 0'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a negative ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['-1'], validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: -1'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a decimal ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1.5'], validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: 1.5'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when one ID in a mixed array is invalid', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1', 'abc', '3'], validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: abc'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });
});
