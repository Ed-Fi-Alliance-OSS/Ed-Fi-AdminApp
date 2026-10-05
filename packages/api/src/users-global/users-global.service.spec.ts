import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken, getRepositoryToken } from '@nestjs/typeorm';
import { User } from '@edanalytics/models-server';
import { GetUserDto, PostUserDto, PutUserDto } from '@edanalytics/models';
import { UsersGlobalService } from './users-global.service';
import { PrivilegeGrantGuardService } from '../auth/authorization/privilege-grant-guard.service';

const mockUser: Partial<User> = {
  id: 1,
  username: 'alice',
  roleId: 2,
  isActive: true,
};

const mockRepo = {
  create: jest.fn((dto) => ({ ...dto })),
  save: jest.fn(async (entity) => ({ ...mockUser, ...entity, id: entity.id ?? 1 })),
  findOneByOrFail: jest.fn(async ({ id, username }: { id?: number; username?: string }) => {
    if (id === 1 || username === 'alice') return { ...mockUser };
    throw new Error('Not found');
  }),
  remove: jest.fn(async () => undefined),
  find: jest.fn(async () => [mockUser]),
};

const mockGuard = { assertCanAssignRole: jest.fn(async (..._args: unknown[]) => undefined) };

describe('UsersGlobalService', () => {
  let service: UsersGlobalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersGlobalService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: getEntityManagerToken(), useValue: {} },
        { provide: PrivilegeGrantGuardService, useValue: mockGuard },
      ],
    }).compile();
    service = module.get(UsersGlobalService);
  });

  it('create() saves a new user', async () => {
    const dto = { username: 'bob', roleId: 1 } as unknown as PostUserDto;
    await service.create(dto, 42);
    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('findOne() returns a user by id', async () => {
    const result = await service.findOne(1);
    expect(result).toMatchObject({ id: 1, username: 'alice' });
    expect(mockRepo.findOneByOrFail).toHaveBeenCalledWith({ id: 1 });
  });

  it('findOne() throws when user not found', async () => {
    await expect(service.findOne(999)).rejects.toThrow();
  });

  it('findByUsername() returns a user by username', async () => {
    const result = await service.findByUsername('alice');
    expect(result).toMatchObject({ username: 'alice' });
    expect(mockRepo.findOneByOrFail).toHaveBeenCalledWith({ username: 'alice' });
  });

  it('update() applies allowed fields and saves', async () => {
    const dto = { username: 'alice2', roleId: 3, isActive: false } as unknown as PutUserDto;
    await service.update(1, dto, 42);
    expect(mockRepo.save).toHaveBeenCalled();
    const savedArg = mockRepo.save.mock.calls[0][0];
    expect(savedArg.username).toBe('alice2');
    expect(savedArg.roleId).toBe(3);
  });

  it('remove() removes the user and returns undefined', async () => {
    const result = await service.remove(1, { id: 99 } as unknown as GetUserDto);
    expect(mockRepo.remove).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('remove() throws NotFoundException when user not found', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    await expect(service.remove(999, { id: 1 } as unknown as GetUserDto)).rejects.toThrow(NotFoundException);
  });

  it('create() checks the global role', async () => {
    const dto = { username: 'bob', roleId: 1 } as unknown as PostUserDto;
    await service.create(dto, 42);
    expect(mockGuard.assertCanAssignRole).toHaveBeenCalledWith(42, 1, { kind: 'global-user' });
  });

  it('create() persists only explicit scalar fields, ignoring relation keys in the body', async () => {
    const dto = {
      username: 'bob',
      userType: 'human',
      isActive: true,
      roleId: 3,
      givenName: 'Bob',
      familyName: 'Smith',
      createdById: 42,
      role: { id: 2 },
      userTeamMemberships: [{ teamId: 1, roleId: 2 }],
      id: 1,
    } as unknown as PostUserDto;
    await service.create(dto, 42);
    expect(mockGuard.assertCanAssignRole).toHaveBeenCalledWith(42, 3, { kind: 'global-user' });
    expect(mockRepo.create).toHaveBeenCalledWith({
      username: 'bob',
      userType: 'human',
      isActive: true,
      roleId: 3,
      givenName: 'Bob',
      familyName: 'Smith',
      createdById: 42,
    });
    const saved = mockRepo.save.mock.calls[0][0];
    expect(saved).not.toHaveProperty('role');
    expect(saved).not.toHaveProperty('userTeamMemberships');
    expect(saved).not.toHaveProperty('id');
  });

  it('create() does not save when the guard rejects', async () => {
    mockGuard.assertCanAssignRole.mockRejectedValueOnce(new Error('403'));
    const dto = { username: 'bob', roleId: 2 } as unknown as PostUserDto;
    await expect(service.create(dto, 42)).rejects.toThrow('403');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('update() checks the new role against the previous role', async () => {
    // mockUser.roleId === 2
    await service.update(1, { roleId: 5 } as unknown as PutUserDto, 42);
    expect(mockGuard.assertCanAssignRole).toHaveBeenCalledWith(42, 5, { kind: 'global-user' }, 2);
  });

  it('update() without roleId (e.g. name change) is treated as unchanged and saves', async () => {
    await service.update(1, { givenName: 'Al' } as unknown as PutUserDto, 42);
    expect(mockGuard.assertCanAssignRole).toHaveBeenCalledWith(42, 2, { kind: 'global-user' }, 2);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('update() does not save when the guard rejects', async () => {
    mockGuard.assertCanAssignRole.mockRejectedValueOnce(new Error('403'));
    await expect(service.update(1, { roleId: 5 } as unknown as PutUserDto, 42)).rejects.toThrow('403');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
