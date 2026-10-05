import 'reflect-metadata';
import { HttpException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityNotFoundError } from 'typeorm';
import { PrivilegeCode, RoleType } from '@edanalytics/models';
import { Role } from '@edanalytics/models-server';
import { AuthService } from '../auth.service';
import { ValidationHttpException } from '../../utils/customExceptions';
import { PrivilegeGrantGuardService } from './privilege-grant-guard.service';

const held = (...codes: string[]) => new Set(codes as PrivilegeCode[]);

const mockAuthService = { getUserPrivileges: jest.fn() };
const mockRolesRepo = { findOneBy: jest.fn() };

const expectStatus = async (promise: Promise<unknown>, status: number) => {
  const err = await promise.then(
    () => undefined,
    (e) => e,
  );
  expect(err).toBeInstanceOf(HttpException);
  expect((err as HttpException).getStatus()).toBe(status);
  return err as HttpException;
};

describe('PrivilegeGrantGuardService', () => {
  let guard: PrivilegeGrantGuardService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivilegeGrantGuardService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: getRepositoryToken(Role), useValue: mockRolesRepo },
      ],
    }).compile();
    guard = module.get(PrivilegeGrantGuardService);
  });

  describe('assertCanGrant', () => {
    it('resolves for an empty list without looking up privileges', async () => {
      await expect(guard.assertCanGrant(1, [])).resolves.toBeUndefined();
      expect(mockAuthService.getUserPrivileges).not.toHaveBeenCalled();
    });

    it('resolves when the actor holds every code', async () => {
      mockAuthService.getUserPrivileges.mockResolvedValue(held('team.role:read', 'team.user:read'));
      await expect(
        guard.assertCanGrant(1, ['team.role:read', 'team.user:read'] as PrivilegeCode[], 7),
      ).resolves.toBeUndefined();
    });

    it('passes teamId through to getUserPrivileges', async () => {
      mockAuthService.getUserPrivileges.mockResolvedValue(held('team.role:read'));
      await guard.assertCanGrant(1, ['team.role:read'] as PrivilegeCode[], 7);
      expect(mockAuthService.getUserPrivileges).toHaveBeenCalledWith(1, 7);
    });

    it('throws 403 listing only the missing codes, sorted', async () => {
      mockAuthService.getUserPrivileges.mockResolvedValue(held('team.role:read'));
      const err = await expectStatus(
        guard.assertCanGrant(
          1,
          ['team.user:read', 'team.role:read', 'team.role:create'] as PrivilegeCode[],
          7,
        ),
        403,
      );
      expect(err.getResponse()).toEqual({
        type: 'Error',
        title: 'Insufficient privileges',
        message: 'You cannot grant privileges you do not hold: team.role:create, team.user:read',
      });
    });

    it('throws 403 (not 500) when the actor is inactive or missing', async () => {
      mockAuthService.getUserPrivileges.mockRejectedValue(new EntityNotFoundError(Role, {}));
      await expect(
        expectStatus(guard.assertCanGrant(1, ['me:read'] as PrivilegeCode[]), 403),
      ).resolves.toBeInstanceOf(HttpException);
    });

    it('rethrows unexpected errors', async () => {
      mockAuthService.getUserPrivileges.mockRejectedValue(new Error('db down'));
      await expect(guard.assertCanGrant(1, ['me:read'] as PrivilegeCode[])).rejects.toThrow(
        'db down',
      );
    });
  });

  describe('findMissing', () => {
    it('deduplicates and sorts', async () => {
      mockAuthService.getUserPrivileges.mockResolvedValue(held());
      await expect(
        guard.findMissing(1, ['user:read', 'me:read', 'user:read'] as PrivilegeCode[]),
      ).resolves.toEqual(['me:read', 'user:read']);
    });
  });

  describe('assertCanAssignRole', () => {
    const teamCtx = { kind: 'team-membership' as const, teamId: 7 };
    const globalCtx = { kind: 'global-user' as const };

    it('is a no-op for null or undefined roleId', async () => {
      await guard.assertCanAssignRole(1, null, teamCtx);
      await guard.assertCanAssignRole(1, undefined, globalCtx);
      expect(mockRolesRepo.findOneBy).not.toHaveBeenCalled();
      expect(mockAuthService.getUserPrivileges).not.toHaveBeenCalled();
    });

    it('is a no-op when roleId is unchanged', async () => {
      await guard.assertCanAssignRole(1, 5, teamCtx, 5);
      expect(mockRolesRepo.findOneBy).not.toHaveBeenCalled();
      expect(mockAuthService.getUserPrivileges).not.toHaveBeenCalled();
    });

    it('checks when previous role was null and a role is now assigned', async () => {
      mockRolesRepo.findOneBy.mockResolvedValue({
        id: 5,
        type: RoleType.UserTeam,
        teamId: 7,
        privilegeIds: ['team.role:read'],
      });
      mockAuthService.getUserPrivileges.mockResolvedValue(held('team.role:read'));
      await guard.assertCanAssignRole(1, 5, teamCtx, null);
      expect(mockAuthService.getUserPrivileges).toHaveBeenCalledWith(1, 7);
    });

    it('400 when the role does not exist', async () => {
      mockRolesRepo.findOneBy.mockResolvedValue(null);
      await expect(guard.assertCanAssignRole(1, 5, teamCtx)).rejects.toThrow(
        ValidationHttpException,
      );
    });

    it('team: accepts a UserTeam role from the same team', async () => {
      mockRolesRepo.findOneBy.mockResolvedValue({
        id: 5,
        type: RoleType.UserTeam,
        teamId: 7,
        privilegeIds: ['team.role:read'],
      });
      mockAuthService.getUserPrivileges.mockResolvedValue(held('team.role:read'));
      await expect(guard.assertCanAssignRole(1, 5, teamCtx)).resolves.toBeUndefined();
    });

    it('team: accepts a public UserTeam role (teamId null)', async () => {
      mockRolesRepo.findOneBy.mockResolvedValue({
        id: 6,
        type: RoleType.UserTeam,
        teamId: null,
        privilegeIds: ['team.role:read'],
      });
      mockAuthService.getUserPrivileges.mockResolvedValue(held('team.role:read'));
      await expect(guard.assertCanAssignRole(1, 6, teamCtx)).resolves.toBeUndefined();
    });

    it("team: 400 for another team's role", async () => {
      mockRolesRepo.findOneBy.mockResolvedValue({
        id: 5,
        type: RoleType.UserTeam,
        teamId: 99,
        privilegeIds: [],
      });
      await expect(guard.assertCanAssignRole(1, 5, teamCtx)).rejects.toThrow(
        ValidationHttpException,
      );
    });

    it.each([RoleType.UserGlobal, RoleType.ResourceOwnership])(
      'team: 400 for %s roles',
      async (type) => {
        mockRolesRepo.findOneBy.mockResolvedValue({ id: 5, type, teamId: null, privilegeIds: [] });
        await expect(guard.assertCanAssignRole(1, 5, teamCtx)).rejects.toThrow(
          ValidationHttpException,
        );
      },
    );

    it('global-user: accepts UserGlobal and checks without team', async () => {
      mockRolesRepo.findOneBy.mockResolvedValue({
        id: 2,
        type: RoleType.UserGlobal,
        teamId: null,
        privilegeIds: ['me:read'],
      });
      mockAuthService.getUserPrivileges.mockResolvedValue(held('me:read'));
      await guard.assertCanAssignRole(1, 2, globalCtx);
      expect(mockAuthService.getUserPrivileges).toHaveBeenCalledWith(1, undefined);
    });

    it.each([RoleType.UserTeam, RoleType.ResourceOwnership])(
      'global-user: 400 for %s roles',
      async (type) => {
        mockRolesRepo.findOneBy.mockResolvedValue({ id: 5, type, teamId: null, privilegeIds: [] });
        await expect(guard.assertCanAssignRole(1, 5, globalCtx)).rejects.toThrow(
          ValidationHttpException,
        );
      },
    );

    it('403 when the role is valid but carries privileges the actor lacks', async () => {
      mockRolesRepo.findOneBy.mockResolvedValue({
        id: 5,
        type: RoleType.UserTeam,
        teamId: 7,
        privilegeIds: ['team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials'],
      });
      mockAuthService.getUserPrivileges.mockResolvedValue(held('team.role:read'));
      await expect(
        expectStatus(guard.assertCanAssignRole(1, 5, teamCtx), 403),
      ).resolves.toBeInstanceOf(HttpException);
    });

    it('logs the assignment target alongside the role on rejection', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      mockRolesRepo.findOneBy.mockResolvedValue({
        id: 5,
        type: RoleType.UserTeam,
        teamId: 7,
        privilegeIds: ['team.role:create'],
      });
      mockAuthService.getUserPrivileges.mockResolvedValue(held());
      await expect(guard.assertCanAssignRole(1, 5, teamCtx, 3, 'membership 9')).rejects.toThrow(
        HttpException,
      );
      expect(warn).toHaveBeenCalledWith(
        'Actor 1 denied granting [team.role:create] in team 7 (membership 9, role 5)',
      );
      warn.mockRestore();
    });

    it.each([
      ['team', teamCtx, RoleType.UserTeam],
      ['global-user', globalCtx, RoleType.UserGlobal],
    ])('%s: treats a role with null privilegeIds as granting nothing', async (_, ctx, type) => {
      mockRolesRepo.findOneBy.mockResolvedValue({ id: 5, type, teamId: 7, privilegeIds: null });
      await expect(guard.assertCanAssignRole(1, 5, ctx)).resolves.toBeUndefined();
    });
  });
});
