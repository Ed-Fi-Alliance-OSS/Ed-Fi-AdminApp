import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PostUserTeamMembershipDto, PutUserTeamMembershipDto } from '@edanalytics/models';
import { UserTeamMembership } from '@edanalytics/models-server';
import { PrivilegeGrantGuardService } from '../../auth/authorization/privilege-grant-guard.service';
import { UserTeamMembershipsService } from './user-team-memberships.service';

const existing = { id: 1, teamId: 7, userId: 10, roleId: 3 };

const mockRepo = {
  create: jest.fn((dto) => ({ ...dto })),
  save: jest.fn(async (entity) => ({ id: 1, ...entity })),
  findOneByOrFail: jest.fn(async () => ({ ...existing })),
};
const mockGuard = { assertCanAssignRole: jest.fn(async () => undefined) };

describe('UserTeamMembershipsService (team)', () => {
  let service: UserTeamMembershipsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTeamMembershipsService,
        { provide: getRepositoryToken(UserTeamMembership), useValue: mockRepo },
        { provide: PrivilegeGrantGuardService, useValue: mockGuard },
      ],
    }).compile();
    service = module.get(UserTeamMembershipsService);
  });

  describe('create', () => {
    it('checks the assigned role in the team context', async () => {
      const dto = { teamId: 7, userId: 11, roleId: 4 } as PostUserTeamMembershipDto;
      await service.create(dto, 42);
      expect(mockGuard.assertCanAssignRole).toHaveBeenCalledWith(42, 4, {
        kind: 'team-membership',
        teamId: 7,
      });
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('persists only explicit scalar fields, ignoring relation keys in the body', async () => {
      const dto = {
        teamId: 7,
        userId: 11,
        roleId: 3,
        createdById: 42,
        role: { id: 2 },
        team: { id: 99 },
        user: { id: 99 },
      } as unknown as PostUserTeamMembershipDto;
      await service.create(dto, 42);
      expect(mockGuard.assertCanAssignRole).toHaveBeenCalledWith(42, 3, {
        kind: 'team-membership',
        teamId: 7,
      });
      expect(mockRepo.create).toHaveBeenCalledWith({
        teamId: 7,
        userId: 11,
        roleId: 3,
        createdById: 42,
      });
      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved).not.toHaveProperty('role');
      expect(saved).not.toHaveProperty('team');
      expect(saved).not.toHaveProperty('user');
    });

    it('does not save when the guard rejects', async () => {
      mockGuard.assertCanAssignRole.mockRejectedValueOnce(new Error('403'));
      const dto = { teamId: 7, userId: 11, roleId: 4 } as PostUserTeamMembershipDto;
      await expect(service.create(dto, 42)).rejects.toThrow('403');
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it("never passes an injected id through, so save() cannot overwrite another team's membership", async () => {
      // Shape the controller sends: body spread with the route teamId (AC-642).
      const dto = { id: 7, userId: 5, roleId: 2, teamId: 1 } as PostUserTeamMembershipDto;

      await service.create(dto, 42);

      expect(mockRepo.create).toHaveBeenCalledWith({ userId: 5, roleId: 2, teamId: 1 });
      expect(mockRepo.save.mock.calls[0][0]).not.toHaveProperty('id');
    });
  });

  describe('update', () => {
    it('checks the new role against the previous role', async () => {
      await service.update(7, 1, { roleId: 4 } as PutUserTeamMembershipDto, 42);
      expect(mockGuard.assertCanAssignRole).toHaveBeenCalledWith(
        42,
        4,
        { kind: 'team-membership', teamId: 7 },
        3,
        'membership 1'
      );
    });

    it('treats a body without roleId as unchanged', async () => {
      await service.update(7, 1, {} as PutUserTeamMembershipDto, 42);
      expect(mockGuard.assertCanAssignRole).toHaveBeenCalledWith(
        42,
        3,
        { kind: 'team-membership', teamId: 7 },
        3,
        'membership 1'
      );
    });

    it('passes an explicit null roleId through (unassign)', async () => {
      await service.update(7, 1, { roleId: null } as unknown as PutUserTeamMembershipDto, 42);
      expect(mockGuard.assertCanAssignRole).toHaveBeenCalledWith(
        42,
        null,
        { kind: 'team-membership', teamId: 7 },
        3,
        'membership 1'
      );
    });

    it('ignores teamId and userId in the body', async () => {
      const dto = {
        roleId: 4,
        teamId: 99,
        userId: 99,
        modifiedById: 42,
      } as unknown as PutUserTeamMembershipDto;
      await service.update(7, 1, dto, 42);
      expect(mockRepo.save).toHaveBeenCalledWith({
        id: 1,
        teamId: 7,
        userId: 10,
        roleId: 4,
        modifiedById: 42,
      });
    });

    it('does not save when the guard rejects', async () => {
      mockGuard.assertCanAssignRole.mockRejectedValueOnce(new Error('403'));
      await expect(
        service.update(7, 1, { roleId: 4 } as PutUserTeamMembershipDto, 42)
      ).rejects.toThrow('403');
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
