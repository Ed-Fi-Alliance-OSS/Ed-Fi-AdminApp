import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken, getRepositoryToken } from '@nestjs/typeorm';
import { UserTeamMembership } from '@edanalytics/models-server';
import {
  GetUserDto,
  PostUserTeamMembershipDto,
  PutUserTeamMembershipDto,
} from '@edanalytics/models';
import { UserTeamMembershipsGlobalService } from './user-team-memberships-global.service';
import { PrivilegeGrantGuardService } from '../auth/authorization/privilege-grant-guard.service';

const mockMembership = { id: 1, userId: 10, teamId: 2, roleId: 3 };

const mockRepo = {
  create: jest.fn((dto) => ({ ...dto })),
  save: jest.fn(async (entity) => ({ ...mockMembership, ...entity, id: entity.id ?? 1 })),
  findOneByOrFail: jest.fn(async ({ id }: { id: number }) => {
    if (id === 1) return { ...mockMembership };
    throw new Error('Not found');
  }),
  remove: jest.fn(async () => undefined),
};

const mockGuard = { assertCanAssignRole: jest.fn(async () => undefined) };

describe('UserTeamMembershipsGlobalService', () => {
  let service: UserTeamMembershipsGlobalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTeamMembershipsGlobalService,
        { provide: getRepositoryToken(UserTeamMembership), useValue: mockRepo },
        { provide: getEntityManagerToken(), useValue: {} },
        { provide: PrivilegeGrantGuardService, useValue: mockGuard },
      ],
    }).compile();
    service = module.get(UserTeamMembershipsGlobalService);
  });

  it('create() saves a new membership', async () => {
    const dto: PostUserTeamMembershipDto = { userId: 5, teamId: 1, roleId: 2 };
    await service.create(dto, 42);
    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('create() never passes an id through, so save() cannot overwrite an existing row', async () => {
    const dto = { id: 7, userId: 5, teamId: 1, roleId: 2 } as PostUserTeamMembershipDto;
    await service.create(dto, 42);
    expect(mockRepo.create).toHaveBeenCalledWith({ userId: 5, teamId: 1, roleId: 2 });
    expect(mockRepo.save.mock.calls[0][0]).not.toHaveProperty('id');
  });

  it('findOne() returns a membership by id', async () => {
    const result = await service.findOne(1);
    expect(result).toMatchObject({ id: 1, userId: 10 });
    expect(mockRepo.findOneByOrFail).toHaveBeenCalledWith({ id: 1 });
  });

  it('findOne() throws when not found', async () => {
    await expect(service.findOne(999)).rejects.toThrow();
  });

  it('update() applies allowed fields and saves', async () => {
    const dto: PutUserTeamMembershipDto = { id: 1, roleId: 5 };
    await service.update(1, dto, 42);
    expect(mockRepo.save).toHaveBeenCalled();
    const savedArg = mockRepo.save.mock.calls[0][0];
    expect(savedArg.roleId).toBe(5);
  });

  it('remove() removes and returns undefined', async () => {
    const result = await service.remove(1, { id: 99 } as unknown as GetUserDto);
    expect(mockRepo.remove).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('remove() throws NotFoundException when not found', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    await expect(service.remove(999, { id: 1 } as unknown as GetUserDto)).rejects.toThrow(NotFoundException);
  });

  it('create() checks the role in the membership team context', async () => {
    const dto: PostUserTeamMembershipDto = { userId: 5, teamId: 1, roleId: 2 };
    await service.create(dto, 42);
    expect(mockGuard.assertCanAssignRole).toHaveBeenCalledWith(42, 2, { kind: 'team-membership', teamId: 1 });
  });

  it('create() persists only explicit scalar fields, ignoring relation keys in the body', async () => {
    const dto = {
      userId: 5,
      teamId: 1,
      roleId: 3,
      createdById: 42,
      role: { id: 2 },
      team: { id: 99 },
      user: { id: 99 },
    } as unknown as PostUserTeamMembershipDto;
    await service.create(dto, 42);
    expect(mockGuard.assertCanAssignRole).toHaveBeenCalledWith(42, 3, {
      kind: 'team-membership',
      teamId: 1,
    });
    expect(mockRepo.create).toHaveBeenCalledWith({
      teamId: 1,
      userId: 5,
      roleId: 3,
      createdById: 42,
    });
    const saved = mockRepo.save.mock.calls[0][0];
    expect(saved).not.toHaveProperty('role');
    expect(saved).not.toHaveProperty('team');
    expect(saved).not.toHaveProperty('user');
  });

  it('create() does not save when the guard rejects', async () => {
    mockGuard.assertCanAssignRole.mockRejectedValueOnce(new Error('403'));
    await expect(service.create({ userId: 5, teamId: 1, roleId: 2 }, 42)).rejects.toThrow('403');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("update() checks the new role in the existing membership's team, against the previous role", async () => {
    // mockMembership: { id: 1, userId: 10, teamId: 2, roleId: 3 }
    await service.update(1, { roleId: 4 } as PutUserTeamMembershipDto, 42);
    expect(mockGuard.assertCanAssignRole).toHaveBeenCalledWith(42, 4, { kind: 'team-membership', teamId: 2 }, 3, 'membership 1');
  });

  it('update() treats a body without roleId as unchanged', async () => {
    await service.update(1, {} as PutUserTeamMembershipDto, 42);
    expect(mockGuard.assertCanAssignRole).toHaveBeenCalledWith(42, 3, { kind: 'team-membership', teamId: 2 }, 3, 'membership 1');
  });

  it('update() does not save when the guard rejects', async () => {
    mockGuard.assertCanAssignRole.mockRejectedValueOnce(new Error('403'));
    await expect(service.update(1, { roleId: 4 } as PutUserTeamMembershipDto, 42)).rejects.toThrow('403');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
