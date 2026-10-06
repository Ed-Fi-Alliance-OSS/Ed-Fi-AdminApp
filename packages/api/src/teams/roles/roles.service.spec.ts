import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PostRoleDto, PutRoleDto, RoleType } from '@edanalytics/models';
import { Role } from '@edanalytics/models-server';
import { PrivilegeGrantGuardService } from '../../auth/authorization/privilege-grant-guard.service';
import { RolesService } from './roles.service';

const existingRole = {
  id: 3,
  teamId: 7,
  type: RoleType.UserTeam,
  name: 'Ops',
  privilegeIds: ['team.role:read', 'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials'],
};

const mockRolesRepo = {
  save: jest.fn(async (entity) => ({ id: 3, ...entity })),
  findOneBy: jest.fn(async () => ({ ...existingRole })),
};
const mockGuard = {
  assertCanGrant: jest.fn(async () => undefined),
  findMissing: jest.fn(async () => []),
};

describe('RolesService (team)', () => {
  let service: RolesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: mockRolesRepo },
        { provide: PrivilegeGrantGuardService, useValue: mockGuard },
      ],
    }).compile();
    service = module.get(RolesService);
  });

  describe('create', () => {
    const dto = {
      teamId: 7,
      type: RoleType.UserTeam,
      name: 'New',
      privilegeIds: ['team.role:read', 'team.user:read', 'team.role:read'],
    } as unknown as PostRoleDto;

    it('checks all (deduplicated) requested codes in the team context', async () => {
      await service.create(dto, 42);
      expect(mockGuard.assertCanGrant).toHaveBeenCalledWith(42, ['team.role:read', 'team.user:read'], 7);
      expect(mockRolesRepo.save).toHaveBeenCalled();
    });

    it('does not save when the guard rejects', async () => {
      mockGuard.assertCanGrant.mockRejectedValueOnce(new Error('403'));
      await expect(service.create(dto, 42)).rejects.toThrow('403');
      expect(mockRolesRepo.save).not.toHaveBeenCalled();
    });

    it('rejects invalid codes with 400 before calling the guard', async () => {
      const bad = { ...dto, privilegeIds: ['nope:nope'] } as unknown as PostRoleDto;
      await expect(service.create(bad, 42)).rejects.toThrow(BadRequestException);
      expect(mockGuard.assertCanGrant).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('treats a stored role with null privilegeIds as having none', async () => {
      mockRolesRepo.findOneBy.mockResolvedValueOnce({ ...existingRole, privilegeIds: null });
      const dto = { name: 'Ops', privilegeIds: ['team.role:read'] } as unknown as PutRoleDto;
      const result = await service.update(7, 3, dto, 42);
      expect(mockGuard.findMissing).toHaveBeenCalledWith(42, ['team.role:read'], 7, 'role 3');
      expect(result.status).toBe('SUCCESS');
    });

    it('checks only newly added codes', async () => {
      const dto = {
        name: 'Ops',
        privilegeIds: ['team.role:read', 'team.user:read'],
      } as unknown as PutRoleDto;
      await service.update(7, 3, dto, 42);
      expect(mockGuard.findMissing).toHaveBeenCalledWith(42, ['team.user:read'], 7, 'role 3');
    });

    it('allows renaming a role that holds codes the editor lacks (no additions)', async () => {
      const dto = { name: 'Renamed', privilegeIds: existingRole.privilegeIds } as unknown as PutRoleDto;
      const result = await service.update(7, 3, dto, 42);
      expect(mockGuard.findMissing).toHaveBeenCalledWith(42, [], 7, 'role 3');
      expect(result.status).toBe('SUCCESS');
    });

    it('allows trimming privileges', async () => {
      const dto = { name: 'Ops', privilegeIds: ['team.role:read'] } as unknown as PutRoleDto;
      const result = await service.update(7, 3, dto, 42);
      expect(result.status).toBe('SUCCESS');
    });

    it('returns INSUFFICIENT_PRIVILEGES with the missing codes and does not save', async () => {
      mockGuard.findMissing.mockResolvedValueOnce(['team.user:read']);
      const dto = { name: 'Ops', privilegeIds: ['team.role:read', 'team.user:read'] } as unknown as PutRoleDto;
      const result = await service.update(7, 3, dto, 42);
      expect(result).toEqual({ status: 'INSUFFICIENT_PRIVILEGES', missing: ['team.user:read'] });
      expect(mockRolesRepo.save).not.toHaveBeenCalled();
    });

    it('returns INVALID_PRIVILEGES before calling the guard', async () => {
      const dto = { name: 'Ops', privilegeIds: ['nope:nope'] } as unknown as PutRoleDto;
      const result = await service.update(7, 3, dto, 42);
      expect(result.status).toBe('INVALID_PRIVILEGES');
      expect(mockGuard.findMissing).not.toHaveBeenCalled();
    });
  });
});
