import { Ownership, Team, User, UserTeamMembership } from '@edanalytics/models-server';
import { registerDeleteSnapshot } from './delete-snapshot.registry';

/**
 * Delete snapshots. Each builder is an allowlist: it names the fields it keeps, using names
 * instead of ids, and never reads emails, passwords, secrets, tokens or other credentials.
 * Every entity decorated with @AuditDelete must be registered here.
 */

type Named = { name?: string | null } | null | undefined;

const nameOf = (target: Named): string | null => target?.name ?? null;

const ownershipResource = (ownership: Ownership): { type: string; name: string | null } | null => {
  if (ownership.sbEnvironment) {
    return { type: 'sbEnvironment', name: nameOf(ownership.sbEnvironment) };
  }
  if (ownership.edfiTenant) {
    return { type: 'edfiTenant', name: nameOf(ownership.edfiTenant) };
  }
  if (ownership.ods) {
    return { type: 'ods', name: ownership.ods.dbName ?? null };
  }
  if (ownership.edorg) {
    return { type: 'edorg', name: ownership.edorg.nameOfInstitution ?? null };
  }
  if (ownership.integrationProvider) {
    return { type: 'integrationProvider', name: nameOf(ownership.integrationProvider) };
  }
  return null;
};

registerDeleteSnapshot(
  User,
  (user) => ({
    username: user.username,
    userType: user.userType,
    role: nameOf(user.role),
  }),
  { relations: ['role'] },
);

registerDeleteSnapshot(Team, (team) => ({ name: team.name }));

registerDeleteSnapshot(
  Ownership,
  (ownership) => {
    const resource = ownershipResource(ownership);
    return {
      team: nameOf(ownership.team),
      role: nameOf(ownership.role),
      resourceType: resource?.type ?? null,
      resource: resource?.name ?? null,
    };
  },
  {
    relations: [
      'team',
      'role',
      'sbEnvironment',
      'edfiTenant',
      'ods',
      'edorg',
      'integrationProvider',
    ],
  },
);

registerDeleteSnapshot(
  UserTeamMembership,
  (membership) => ({
    username: membership.user?.username ?? null,
    team: nameOf(membership.team),
    role: nameOf(membership.role),
  }),
  { relations: ['user', 'team', 'role'] },
);

/** The entities whose deletes are audited; the registrations spec checks each has a builder. */
export const AUDITED_DELETE_ENTITIES = [User, Team, Ownership, UserTeamMembership];
