import 'reflect-metadata';
import {
  Edorg,
  EdfiTenant,
  IntegrationProvider,
  Ods,
  Ownership,
  Role,
  SbEnvironment,
  Team,
  User,
  UserTeamMembership,
} from '@edanalytics/models-server';
import { AUDIT_DELETE_METADATA, AuditDeleteMetadata } from './audit-delete.decorator';
import { getDeleteSnapshotBuilder, getDeleteSnapshotRelations } from './delete-snapshot.registry';
import { AUDITED_DELETE_ENTITIES } from './delete-snapshot.registrations';
import { UsersGlobalController } from '../users-global/users-global.controller';
import { TeamsGlobalController } from '../teams/teams-global.controller';
import { OwnershipsGlobalController } from '../ownerships-global/ownerships-global.controller';
import { UserTeamMembershipsGlobalController } from '../user-team-memberships-global/user-team-memberships-global.controller';
import { UserTeamMembershipsController } from '../teams/user-team-memberships/user-team-memberships.controller';

// The real AuthService fails type-checking under the stale node_modules; the test never needs it.
jest.mock('../auth/auth.service', () => ({ AuthService: class AuthService {} }));

const FORBIDDEN_KEYS = ['password', 'clientSecret', 'secret', 'token', 'email'];

const role = Object.assign(new Role(), { id: 5, name: 'Admin' });
const team = Object.assign(new Team(), { id: 3, name: 'Team A' });
const user = Object.assign(new User(), {
  id: 7,
  username: 'jdoe',
  userType: 'human',
  clientId: 'client-secret-id',
  givenName: 'John',
  role,
});

const expectNoForbiddenKeys = (snapshot: Record<string, unknown>) => {
  const keys = Object.keys(snapshot).map((k) => k.toLowerCase());
  FORBIDDEN_KEYS.forEach((forbidden) => expect(keys).not.toContain(forbidden.toLowerCase()));
};

const build = (entity: unknown, target: unknown) => {
  const builder = getDeleteSnapshotBuilder(entity as never);
  expect(builder).toBeDefined();
  return (builder as (t: unknown) => Record<string, unknown>)(target);
};

describe('delete snapshot registrations', () => {
  it('registers a builder for every audited entity', () => {
    expect(AUDITED_DELETE_ENTITIES).toEqual(
      expect.arrayContaining([User, Team, Ownership, UserTeamMembership]),
    );
    AUDITED_DELETE_ENTITIES.forEach((entity) =>
      expect(getDeleteSnapshotBuilder(entity)).toBeDefined(),
    );
  });

  it('registers a builder for every entity named by an @AuditDelete decorator', () => {
    const controllers = [
      UsersGlobalController,
      TeamsGlobalController,
      OwnershipsGlobalController,
      UserTeamMembershipsGlobalController,
      UserTeamMembershipsController,
    ];
    controllers.forEach((controller) => {
      const meta: AuditDeleteMetadata = Reflect.getMetadata(
        AUDIT_DELETE_METADATA,
        controller.prototype.remove,
      );
      expect(meta).toBeDefined();
      expect(getDeleteSnapshotBuilder(meta.entity)).toBeDefined();
    });
  });

  it('decorates remove with the right entity and id param', () => {
    const meta = (c: { prototype: { remove: unknown } }) =>
      Reflect.getMetadata(AUDIT_DELETE_METADATA, c.prototype.remove as object);
    expect(meta(UsersGlobalController)).toEqual({ entity: User, idParam: 'userId' });
    expect(meta(TeamsGlobalController)).toEqual({ entity: Team, idParam: 'teamId' });
    expect(meta(OwnershipsGlobalController)).toEqual({
      entity: Ownership,
      idParam: 'ownershipId',
    });
    expect(meta(UserTeamMembershipsGlobalController)).toEqual({
      entity: UserTeamMembership,
      idParam: 'userTeamMembershipId',
    });
    expect(meta(UserTeamMembershipsController)).toEqual({
      entity: UserTeamMembership,
      idParam: 'userTeamMembershipId',
    });
  });

  describe('User', () => {
    it('snapshots username, user type and role name only', () => {
      const snapshot = build(User, user);
      expect(snapshot).toEqual({ username: 'jdoe', userType: 'human', role: 'Admin' });
      expectNoForbiddenKeys(snapshot);
    });
    it('tolerates a missing role', () => {
      expect(
        build(User, Object.assign(new User(), { username: 'm', userType: 'machine' })),
      ).toEqual({ username: 'm', userType: 'machine', role: null });
    });
    it('loads the role relation', () => {
      expect(getDeleteSnapshotRelations(User)).toEqual(['role']);
    });
  });

  describe('Team', () => {
    it('snapshots the team name only', () => {
      const snapshot = build(Team, team);
      expect(snapshot).toEqual({ name: 'Team A' });
      expectNoForbiddenKeys(snapshot);
    });
  });

  describe('Ownership', () => {
    const base = { id: 1, team, role };
    it.each([
      ['sbEnvironment', Object.assign(new SbEnvironment(), { name: 'env1' }), 'env1'],
      ['edfiTenant', Object.assign(new EdfiTenant(), { name: 'tenant1' }), 'tenant1'],
      ['ods', Object.assign(new Ods(), { dbName: 'ods_1' }), 'ods_1'],
      ['edorg', Object.assign(new Edorg(), { nameOfInstitution: 'District' }), 'District'],
      [
        'integrationProvider',
        Object.assign(new IntegrationProvider(), { name: 'Provider' }),
        'Provider',
      ],
    ])('snapshots team, role and %s name', (type, resource, resourceName) => {
      const snapshot = build(Ownership, Object.assign(new Ownership(), base, { [type]: resource }));
      expect(snapshot).toEqual({
        team: 'Team A',
        role: 'Admin',
        resourceType: type,
        resource: resourceName,
      });
      expectNoForbiddenKeys(snapshot);
    });
    it('tolerates missing relations', () => {
      expect(build(Ownership, Object.assign(new Ownership(), { id: 1 }))).toEqual({
        team: null,
        role: null,
        resourceType: null,
        resource: null,
      });
    });
    it('loads team, role and resource relations', () => {
      expect(getDeleteSnapshotRelations(Ownership)).toEqual(
        expect.arrayContaining([
          'team',
          'role',
          'sbEnvironment',
          'edfiTenant',
          'ods',
          'edorg',
          'integrationProvider',
        ]),
      );
    });
  });

  describe('UserTeamMembership', () => {
    it('snapshots username, team name and role name only', () => {
      const snapshot = build(
        UserTeamMembership,
        Object.assign(new UserTeamMembership(), { id: 9, user, team, role }),
      );
      expect(snapshot).toEqual({ username: 'jdoe', team: 'Team A', role: 'Admin' });
      expectNoForbiddenKeys(snapshot);
    });
    it('tolerates missing relations', () => {
      expect(build(UserTeamMembership, new UserTeamMembership())).toEqual({
        username: null,
        team: null,
        role: null,
      });
    });
    it('loads user, team and role relations', () => {
      expect(getDeleteSnapshotRelations(UserTeamMembership)).toEqual(['user', 'team', 'role']);
    });
  });
});
