import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { getEntityManagerToken, getRepositoryToken } from '@nestjs/typeorm';
import {
  PostRoleDto,
  PostUserTeamMembershipDto,
  PutUserDto,
  PutUserTeamMembershipDto,
  RoleType,
} from '@edanalytics/models';
import {
  EdfiTenant,
  EdOrgClosure,
  Edorg,
  Ods,
  Ownership,
  Role,
  User,
  UserTeamMembership,
} from '@edanalytics/models-server';
import { CacheService } from '../../app/cache.module';
import { RolesGlobalService } from '../../roles-global/roles-global.service';
import { RolesService } from '../../teams/roles/roles.service';
import { UserTeamMembershipsService } from '../../teams/user-team-memberships/user-team-memberships.service';
import { UsersGlobalService } from '../../users-global/users-global.service';
import { AuthService } from '../auth.service';
import { PrivilegeGrantGuardService } from './privilege-grant-guard.service';

/**
 * AC-644 end-to-end at the service layer: the real AuthService (privilege resolution), the real
 * PrivilegeGrantGuardService and the real role/assignment services, over in-memory repositories.
 * Nothing in the privilege path is mocked, so these tests show the ticket's attack — an actor
 * granting themselves privileges they do not hold — ends in a 403.
 */

const ACTOR_ID = 42;
const TEAM_ID = 7;
const MEMBERSHIP_ID = 9;
const RESET_CREDENTIALS = 'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials';

const roleFixtures = (): Record<number, Partial<Role>> => ({
  // The actor's global role: can manage roles, users and memberships, and holds one team privilege.
  1: {
    id: 1,
    type: RoleType.UserGlobal,
    teamId: null,
    privilegeIds: [
      'me:read',
      'role:create',
      'role:update',
      'user:update',
      'user-team-membership:create',
      'user-team-membership:update',
      'team.user:read',
    ],
  },
  // Seeded Global admin.
  2: { id: 2, type: RoleType.UserGlobal, teamId: null, privilegeIds: ['me:read', 'user:delete'] },
  // The actor's role in team 7: may manage roles and memberships there, nothing on applications.
  10: {
    id: 10,
    type: RoleType.UserTeam,
    teamId: TEAM_ID,
    privilegeIds: [
      'team.role:create',
      'team.role:read',
      'team.user-team-membership:create',
      'team.user-team-membership:update',
    ],
  },
  // A stronger team role: adds reset-credentials.
  11: {
    id: 11,
    type: RoleType.UserTeam,
    teamId: TEAM_ID,
    privilegeIds: ['team.role:create', 'team.role:read', RESET_CREDENTIALS],
  },
  // A weaker team role, fully within what the actor holds.
  12: { id: 12, type: RoleType.UserTeam, teamId: TEAM_ID, privilegeIds: ['team.role:read'] },
});

describe('AC-644 privilege escalation (real guard + real AuthService)', () => {
  let roles: Record<number, Partial<Role>>;
  let memberships: Partial<UserTeamMembership>[];
  let users: Partial<User>[];
  let saved: unknown[];

  const roleRepo = {
    findOneBy: jest.fn(async ({ id }) => roles[id] ?? null),
    findOneByOrFail: jest.fn(async ({ id }) => {
      if (!roles[id]) throw new Error('not found');
      return { ...roles[id] };
    }),
    save: jest.fn(async (entity) => (saved.push(entity), { id: 99, ...entity })),
  };
  const membershipRepo = {
    // AuthService.getUserPrivileges: membership with its role.
    findOne: jest.fn(async ({ where: { userId, teamId } }) => {
      const m = memberships.find((x) => x.userId === userId && x.teamId === teamId);
      return m ? { ...m, role: roles[m.roleId] } : null;
    }),
    findOneByOrFail: jest.fn(async ({ id, teamId }) => {
      const m = memberships.find((x) => x.id === id && (teamId === undefined || x.teamId === teamId));
      if (!m) throw new Error('not found');
      return { ...m };
    }),
    create: jest.fn((entity) => ({ ...entity })),
    save: jest.fn(async (entity) => (saved.push(entity), { id: 99, ...entity })),
  };
  const userRepo = {
    // AuthService.getUserPrivileges: active user with their global role.
    findOneOrFail: jest.fn(async ({ where: { id } }) => {
      const u = users.find((x) => x.id === id && x.isActive);
      if (!u) throw new Error('not found');
      return { ...u, role: roles[u.roleId] };
    }),
    findOneByOrFail: jest.fn(async ({ id }) => {
      const u = users.find((x) => x.id === id);
      if (!u) throw new Error('not found');
      return { ...u };
    }),
    create: jest.fn((entity) => ({ ...entity })),
    save: jest.fn(async (entity) => (saved.push(entity), { id: 99, ...entity })),
  };

  let teamMemberships: UserTeamMembershipsService;
  let teamRoles: RolesService;
  let globalUsers: UsersGlobalService;
  let globalRoles: RolesGlobalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    roles = roleFixtures();
    memberships = [{ id: MEMBERSHIP_ID, userId: ACTOR_ID, teamId: TEAM_ID, roleId: 10 }];
    users = [{ id: ACTOR_ID, username: 'actor', isActive: true, roleId: 1 }];
    saved = [];

    const unused = {};
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        PrivilegeGrantGuardService,
        UserTeamMembershipsService,
        RolesService,
        UsersGlobalService,
        RolesGlobalService,
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: getRepositoryToken(UserTeamMembership), useValue: membershipRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Ods), useValue: unused },
        { provide: getRepositoryToken(EdfiTenant), useValue: unused },
        { provide: getRepositoryToken(Edorg), useValue: unused },
        { provide: getRepositoryToken(EdOrgClosure), useValue: unused },
        { provide: getRepositoryToken(Ownership), useValue: unused },
        { provide: getEntityManagerToken(), useValue: { getTreeRepository: () => unused } },
        { provide: CacheService, useValue: unused },
      ],
    }).compile();

    teamMemberships = module.get(UserTeamMembershipsService);
    teamRoles = module.get(RolesService);
    globalUsers = module.get(UsersGlobalService);
    globalRoles = module.get(RolesGlobalService);
  });

  describe('team path', () => {
    it('blocks the actor from assigning themselves a stronger team role', async () => {
      await expect(
        teamMemberships.update(
          TEAM_ID,
          MEMBERSHIP_ID,
          { roleId: 11 } as PutUserTeamMembershipDto,
          ACTOR_ID
        )
      ).rejects.toMatchObject({ status: 403 });
      expect(saved).toHaveLength(0);
    });

    it('blocks the actor from minting a team role with privileges they lack', async () => {
      await expect(
        teamRoles.create(
          {
            teamId: TEAM_ID,
            type: RoleType.UserTeam,
            name: 'Escalate',
            privilegeIds: ['team.role:read', RESET_CREDENTIALS],
          } as PostRoleDto,
          ACTOR_ID
        )
      ).rejects.toMatchObject({ status: 403 });
      expect(saved).toHaveLength(0);
    });

    it('blocks creating a membership for themselves in another team with a stronger role', async () => {
      roles[20] = { id: 20, type: RoleType.UserTeam, teamId: 8, privilegeIds: [RESET_CREDENTIALS] };
      await expect(
        teamMemberships.create(
          { teamId: 8, userId: ACTOR_ID, roleId: 20 } as PostUserTeamMembershipDto,
          ACTOR_ID
        )
      ).rejects.toMatchObject({ status: 403 });
      expect(saved).toHaveLength(0);
    });

    it('allows assigning a role within what the actor holds', async () => {
      await teamMemberships.update(
        TEAM_ID,
        MEMBERSHIP_ID,
        { roleId: 12 } as PutUserTeamMembershipDto,
        ACTOR_ID
      );
      expect(saved).toHaveLength(1);
    });
  });

  describe('global path', () => {
    it('blocks the actor from assigning themselves the Global admin role', async () => {
      await expect(globalUsers.update(ACTOR_ID, { roleId: 2 } as PutUserDto, ACTOR_ID)).rejects.toMatchObject({ status: 403 });
      expect(saved).toHaveLength(0);
    });

    it('blocks the actor from minting a global role with privileges they lack', async () => {
      await expect(
        globalRoles.create(
          {
            type: RoleType.UserGlobal,
            name: 'Escalate',
            privilegeIds: ['me:read', 'user:delete'],
          } as PostRoleDto,
          ACTOR_ID
        )
      ).rejects.toMatchObject({ status: 403 });
      expect(saved).toHaveLength(0);
    });
  });

  describe('global role endpoint checks global privileges only', () => {
    // Pins the intended, conservative behaviour: the global role endpoint resolves privileges
    // without a team, so team privileges held only through a team membership do not count.
    it('does not count team privileges the actor holds only through a team membership', async () => {
      // team.role:create comes from the actor's team-7 role, not their global role.
      await expect(
        globalRoles.create(
          {
            teamId: TEAM_ID,
            type: RoleType.UserTeam,
            name: 'Team role via global endpoint',
            privilegeIds: ['team.role:create'],
          } as PostRoleDto,
          ACTOR_ID
        )
      ).rejects.toMatchObject({ status: 403 });
      expect(saved).toHaveLength(0);
    });

    it('counts team privileges held through the global role', async () => {
      // team.user:read is on the actor's global role, which applies in any team context.
      await globalRoles.create(
        {
          teamId: TEAM_ID,
          type: RoleType.UserTeam,
          name: 'Team role via global endpoint',
          privilegeIds: ['team.user:read'],
        } as PostRoleDto,
        ACTOR_ID
      );
      expect(saved).toHaveLength(1);
    });
  });
});
