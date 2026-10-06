import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken, getRepositoryToken } from '@nestjs/typeorm';
import { Ownership, Role, User, UserTeamMembership } from '@edanalytics/models-server';
import { GetUserDto, PostRoleDto, PutRoleDto } from '@edanalytics/models';
import { CheckAbilityType } from '../auth/authorization';
import { PrivilegeGrantGuardService } from '../auth/authorization/privilege-grant-guard.service';
import { RolesGlobalService } from './roles-global.service';

const mockRole = { id: 1, name: 'Admin', privilegeIds: ['me:read', 'role:read'], displayName: 'Admin' };

const mockRoleRepo = {
  save: jest.fn(async (entity) => ({ ...mockRole, ...entity, id: entity.id ?? 1 })),
  findOneByOrFail: jest.fn(async ({ id }) => {
    if (id === 1) return { ...mockRole };
    throw new Error('Not found');
  }),
  remove: jest.fn(async () => undefined),
};
const mockUtmRepo = { findBy: jest.fn(async () => []) };
const mockUserRepo = { findBy: jest.fn(async () => []) };
const mockOwnershipRepo = { findBy: jest.fn(async () => []) };
const mockGuard = { assertCanGrant: jest.fn(async () => undefined) };

describe('RolesGlobalService', () => {
  let service: RolesGlobalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGlobalService,
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(UserTeamMembership), useValue: mockUtmRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Ownership), useValue: mockOwnershipRepo },
        { provide: getEntityManagerToken(), useValue: {} },
        { provide: PrivilegeGrantGuardService, useValue: mockGuard },
      ],
    }).compile();
    service = module.get(RolesGlobalService);
  });

  it('create() saves a new role with unique privilege ids', async () => {
    const dto = { name: 'Editor', privilegeIds: ['me:read', 'role:read', 'me:read'], type: 'UserGlobal', teamId: null } as unknown as PostRoleDto;
    await service.create(dto, 42);
    expect(mockRoleRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ privilegeIds: ['me:read', 'role:read'] })
    );
  });

  it('create() throws BadRequestException for invalid privileges', async () => {
    const dto = { name: 'Bad', privilegeIds: ['nonexistent:priv'], type: 'UserGlobal', teamId: null } as unknown as PostRoleDto;
    await expect(service.create(dto, 42)).rejects.toThrow(BadRequestException);
  });

  it('findOne() returns a role by id', async () => {
    const result = await service.findOne(1);
    expect(result).toMatchObject({ id: 1, name: 'Admin' });
  });

  it('update() saves with updated fields', async () => {
    const dto = { name: 'Super Admin', privilegeIds: ['me:read'] } as unknown as PutRoleDto;
    await service.update(1, dto, 42);
    expect(mockRoleRepo.save).toHaveBeenCalled();
  });

  it('remove() without force throws when role has memberships', async () => {
    mockUtmRepo.findBy.mockResolvedValueOnce([{ id: 10 }]);
    await expect(service.remove(1, { id: 99 } as unknown as GetUserDto, false)).rejects.toThrow();
  });

  it('remove() without force deletes successfully when no related records exist', async () => {
    const result = await service.remove(1, { id: 99 } as unknown as GetUserDto, false);
    expect(mockRoleRepo.remove).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('remove() with force proceeds when checkAbility allows', async () => {
    mockUserRepo.findBy.mockResolvedValueOnce([{ id: 5 }]);
    const checkAbility = jest.fn(() => true);
    const result = await service.remove(1, { id: 99 } as unknown as GetUserDto, true, checkAbility as unknown as CheckAbilityType);
    expect(mockRoleRepo.remove).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('remove() with force throws when checkAbility denies user update', async () => {
    mockUserRepo.findBy.mockResolvedValueOnce([{ id: 5 }]);
    const checkAbility = jest.fn(() => false);
    await expect(service.remove(1, { id: 99 } as unknown as GetUserDto, true, checkAbility as unknown as CheckAbilityType)).rejects.toThrow();
  });

  it('create() checks all requested codes without team context', async () => {
    const dto = { name: 'Editor', privilegeIds: ['me:read', 'role:read', 'me:read'], type: 'UserGlobal', teamId: null } as unknown as PostRoleDto;
    await service.create(dto, 42);
    expect(mockGuard.assertCanGrant).toHaveBeenCalledWith(42, ['me:read', 'role:read']);
  });

  it('create() does not save when the guard rejects', async () => {
    mockGuard.assertCanGrant.mockRejectedValueOnce(new Error('403'));
    const dto = { name: 'Editor', privilegeIds: ['me:read', 'user:update'], type: 'UserGlobal', teamId: null } as unknown as PostRoleDto;
    await expect(service.create(dto, 42)).rejects.toThrow('403');
    expect(mockRoleRepo.save).not.toHaveBeenCalled();
  });

  it('create() rejects invalid codes before calling the guard', async () => {
    const dto = { name: 'Bad', privilegeIds: ['nonexistent:priv'], type: 'UserGlobal', teamId: null } as unknown as PostRoleDto;
    await expect(service.create(dto, 42)).rejects.toThrow(BadRequestException);
    expect(mockGuard.assertCanGrant).not.toHaveBeenCalled();
  });

  it('update() treats a stored role with null privilegeIds as having none', async () => {
    mockRoleRepo.findOneByOrFail.mockResolvedValueOnce({ ...mockRole, privilegeIds: null });
    const dto = { name: 'Admin', privilegeIds: ['me:read'] } as unknown as PutRoleDto;
    await service.update(1, dto, 42);
    expect(mockGuard.assertCanGrant).toHaveBeenCalledWith(42, ['me:read'], undefined, 'role 1');
  });

  it('update() checks only newly added codes', async () => {
    // existing mockRole holds ['me:read', 'role:read']
    const dto = { name: 'Admin', privilegeIds: ['me:read', 'role:read', 'user:update'] } as unknown as PutRoleDto;
    await service.update(1, dto, 42);
    expect(mockGuard.assertCanGrant).toHaveBeenCalledWith(42, ['user:update'], undefined, 'role 1');
  });

  it('update() with no additions (rename/trim) passes an empty list', async () => {
    const dto = { name: 'Renamed', privilegeIds: ['me:read'] } as unknown as PutRoleDto;
    await service.update(1, dto, 42);
    expect(mockGuard.assertCanGrant).toHaveBeenCalledWith(42, [], undefined, 'role 1');
    expect(mockRoleRepo.save).toHaveBeenCalled();
  });

  it('update() does not save when the guard rejects', async () => {
    mockGuard.assertCanGrant.mockRejectedValueOnce(new Error('403'));
    const dto = { name: 'Admin', privilegeIds: ['me:read', 'user:update'] } as unknown as PutRoleDto;
    await expect(service.update(1, dto, 42)).rejects.toThrow('403');
    expect(mockRoleRepo.save).not.toHaveBeenCalled();
  });
});
