const providerPrivileges = {
  'integration-provider:read': 'Read providers in the global scope.',
  'integration-provider:update': 'Update providers in the global scope.',
  'integration-provider:delete': 'Delete providers in the global scope.',
  'integration-provider:create': 'Create providers in the global scope.',
};

// TODO: add other configs beyond just description. For example whether it inherits upward maybe.
export const privileges = {
  'me:read': 'Read my own user information.',
  'ownership:read': 'Read ownerships in the global scope.',
  'ownership:update': 'Update ownerships in the global scope.',
  'ownership:delete': 'Delete ownerships in the global scope.',
  'ownership:create': 'Create ownerships in the global scope.',
  'role:read': 'Read roles in the global scope.',
  'role:update': 'Update roles in the global scope.',
  'role:delete': 'Delete roles in the global scope.',
  'role:create': 'Create roles in the global scope.',
  'sb-environment.edfi-tenant:read': 'Read environments in the global scope.',
  'sb-environment.edfi-tenant:update': 'Update tenants in the global scope.',
  'sb-environment.edfi-tenant:delete': 'Delete tenants in the global scope.',
  'sb-environment.edfi-tenant:create': 'Create tenants in the global scope.',
  'sb-environment.edfi-tenant:refresh-resources':
    "Sync Ed-Orgs and ODS's for environments in the global scope.",
  'sb-environment:read': 'Read environments in the global scope.',
  'sb-environment:update': 'Update environments in the global scope.',
  'sb-environment:delete': 'Delete environments in the global scope.',
  'sb-environment:create': 'Connect new environments in the global scope.',
  'sb-environment:refresh-resources':
    "Sync Ed-Orgs and ODS's for environments in the global scope.",
  'ods:read': "Read ODS's in the global scope.",
  'ods:read-row-counts': "Read row counts of ODS's in the global scope.",
  'edorg:read': 'Read Ed-Orgs in the global scope.',
  'user:read': 'Read users in the global scope.',
  'user:update': 'Update users in the global scope.',
  'user:delete': 'Delete users in the global scope.',
  'user:create': 'Create users in the global scope.',
  'team:read': 'Read teams in the global scope.',
  'team:update': 'Update teams in the global scope.',
  'team:delete': 'Delete teams in the global scope.',
  'team:create': 'Create teams in the global scope.',
  'user-team-membership:read': 'Read user-team memberships in the global scope.',
  'user-team-membership:update': 'Update user-team memberships in the global scope.',
  'user-team-membership:delete': 'Delete user-team memberships in the global scope.',
  'user-team-membership:create': 'Create user-team memberships in the global scope.',
  'team.ownership:read': "Read your team's resource ownerships.",
  'team.role:read': "Read your team's roles.",
  'team.role:update': "Update your team's roles.",
  'team.role:delete': "Delete your team's roles.",
  'team.role:create': "Create your team's roles.",
  'team.user:read': "Read your team's users.",
  'team.user-team-membership:read': "Read your team's user memberships.",
  'team.user-team-membership:update': "Update your team's user memberships.",
  'team.user-team-membership:delete': "Delete your team's user memberships.",
  'team.user-team-membership:create': "Create your team's user memberships.",
  'team.sb-environment:read': "Read your team's environments.",
  /*
   The reason create-tenant and delete-tenant are on sb-environment and not edfi-tenant
   like they normally would be is to allow ownership/permission inheritance to work
   like normal. There's really a missing pattern here, but few enough instances of it
   that for now they're implemented as one-offs. You should get `read` and `update`
   access to an entity from direct ownership of it, but `create` and `delete` access on
   it and its siblings from ownership of its parent. For now we've hoisted the `create`
   and `delete` privileges up to the parent entity in the two situations where it's
   possible to own them directly, but that's not ideal. Edorgs are the thorniest case
   of it, and these issues should really be fixed when we get to Edorg CRUD if not sooner.
  */
  'team.sb-environment:create-tenant': "Create tenants in your team's environments.",
  'team.sb-environment:delete-tenant': "Delete tenants in your team's environments.",
  'team.sb-environment.edfi-tenant:read': "Read your team's environments.",
  // See comment above about create-tenant and delete-tenant privileges.
  'team.sb-environment.edfi-tenant:create-ods': "Create ODS's in your team's tenant.",
  'team.sb-environment.edfi-tenant:delete-ods': "Delete ODS's in your team's tenant.",
  'team.sb-environment.edfi-tenant.vendor:read': "Read your team's vendors.",
  'team.sb-environment.edfi-tenant.vendor:update': "Update your team's vendors.",
  'team.sb-environment.edfi-tenant.vendor:delete': "Delete your team's vendors.",
  'team.sb-environment.edfi-tenant.vendor:create': "Create your team's vendors.",
  'team.sb-environment.edfi-tenant.profile:read': "Read your team's profiles.",
  'team.sb-environment.edfi-tenant.profile:update': "Update your team's profiles.",
  'team.sb-environment.edfi-tenant.profile:delete': "Delete your team's profiles.",
  'team.sb-environment.edfi-tenant.profile:create': "Create your team's profiles.",
  'team.sb-environment.edfi-tenant.claimset:read': "Read your team's claim-sets.",
  'team.sb-environment.edfi-tenant.claimset:update': "Update your team's claim-sets.",
  'team.sb-environment.edfi-tenant.claimset:delete': "Delete your team's claim-sets.",
  'team.sb-environment.edfi-tenant.claimset:create': "Create your team's claim-sets.",
  'team.sb-environment.edfi-tenant.ods:read': "Read your team's ODS's.",
  'team.sb-environment.edfi-tenant.ods:read-row-counts': "Read row counts of your team's ODS's.",
  'team.sb-environment.edfi-tenant.ods:create-edorg': "Create edorgs in your team's ODS's.",
  'team.sb-environment.edfi-tenant.ods:delete-edorg': "Delete edorgs in your team's ODS's.",
  'team.sb-environment.edfi-tenant.ods.edorg:read': "Read your team's Ed-Orgs.",
  'team.sb-environment.edfi-tenant.ods.edorg.application:read': "Read your team's applications.",
  'team.sb-environment.edfi-tenant.ods.edorg.application:update':
    "Update your team's applications.",
  'team.sb-environment.edfi-tenant.ods.edorg.application:delete':
    "Delete your team's applications.",
  'team.sb-environment.edfi-tenant.ods.edorg.application:create':
    "Create your team's applications.",
  'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials':
    "Reset credentials for your team's applications.",
  'sb-sync-queue:read': 'Read SB sync queue in the global scope.',
  'sb-sync-queue:archive': 'Archive SB sync queue in the global scope.',
  ...providerPrivileges,
};
