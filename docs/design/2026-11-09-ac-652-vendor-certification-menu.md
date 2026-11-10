# AC-652: Vendor Certification menu and role

- **Jira:** [AC-652](https://edfi.atlassian.net/browse/AC-652)
- **Date:** 2026-11-09
- **Status:** Implemented
- **Blocks:** AC-651 (Request New Certification), AC-671 (My products cards)

## Problem

Only Global admins could use certification. The certification controllers are guarded by the
global `sb-environment:update` and `sb-environment:read` privileges, and the only way in is the
global Environments list. Vendors are team-scoped (decided 2026-10-30), so they need a team role
and a place in the team navigation.

This story adds the foundation:

- two team privileges;
- a "Certification vendor" team role;
- a **Certification** heading in the team navigation, with **My products** under it;
- an empty My products page.

Later stories fill the page (AC-651, AC-671) and add more items under the same heading, such as
"Run history" (NEW-02).

## Privileges

Two new team privileges at the data store (ODS) level:

| Code | Description |
|---|---|
| `team.sb-environment.edfi-tenant.ods.certification:read` | Read certifications for your team's data stores. |
| `team.sb-environment.edfi-tenant.ods.certification:run` | Run certifications for your team's data stores. |

They are added everywhere the existing `team.sb-environment.edfi-tenant.ods:*` codes are listed:
`privileges.ts`, `privilege.type.ts`, `privileges-source.ts` and `authorization.ts`, all in
`packages/models/src/types`.

`packages/models/src/utils/validate-privileges.ts` gives both codes the same dependencies:

- `team.sb-environment:read`
- `team.sb-environment.edfi-tenant:read`
- `team.sb-environment.edfi-tenant.ods:read`

`:run` also requires `:read`. A role with certification but without read access to the data store
fails validation.

Global admin **holds** both codes, so they are in `GLOBAL_ADMIN_PRIVILEGE_SNAPSHOT`
(`privilege-snapshot.spec.ts`). They are not in the withheld list.

## Role and migration

### Who can assign the role

A team action needs both of these (see `packages/api/src/auth/authorization/README.md`):

- the user's role grants the privilege;
- the team's **ownership role** on the resource grants it too.

So a vendor role on its own does nothing unless the ownership roles also carry the privileges.

The AC-644 no-escalation rule (`PrivilegeGrantGuardService.assertCanAssignRole`) adds a second
constraint: whoever assigns a role must hold every privilege in it. Global admin therefore has to
receive the new codes, or nobody could assign the role.

Tenant admin (role 6) does **not** get the codes. Only Global admins assign the Certification
vendor role, and a Tenant admin who tries gets a 403. This is intended.

### Migration `1793100000000-AddCertificationVendorRole`

The migration has the same name on PostgreSQL (`migrations/pgsql`) and SQL Server
(`migrations/mssql`). Its constants are frozen in `migrations/shared/ac652-certification-vendor.ts`,
so later model changes can't change what it does.

**`up`** can be run more than once without effect:

1. Adds both codes to **Global admin** (id 2), but only while it is still type `"UserGlobal"`.
2. Adds both codes to **Shared-instance ownership** (id 4) and **Full ownership** (id 5), but only
   while they are still type `"ResourceOwnership"`. Ownership roles a deployment created itself
   are not changed. Admins add the codes to those roles by hand if vendors need them.
3. Inserts the public team role **Certification vendor** (`"UserTeam"`, no `teamId`, no fixed id),
   unless it already exists. Its privileges are:
   - the two certification codes;
   - `team.sb-environment:read`, `team.sb-environment.edfi-tenant:read` and
     `team.sb-environment.edfi-tenant.ods:read`, so the AC-651 popup can list environments,
     tenants and data stores.

**`down`:**

1. Sets `roleId` to null on any `user_team_membership` that uses the role. The foreign key's
   `ON DELETE SET NULL` already does this; the explicit update makes the intent visible.
2. Deletes the role.
3. Removes both codes from roles 2, 4 and 5, with the same type checks as `up`.

The codes are new in this story, so removing them is safe. This is unlike AC-644, whose down
migration does nothing.

`privilegeIds` is a text array on PostgreSQL and a comma-separated string on SQL Server. The SQL
Server migration matches whole codes, so one code can't match the start of another.

## API

`EnvNavDto` (`packages/models/src/dtos/env-nav.dto.ts`) has a new `certifications: boolean`.
`TeamsGlobalController.envNav` sets it per tenant row from
`team.sb-environment.edfi-tenant.ods.certification:read` in the user's privilege cache.

## Front end

### `useCanSeeCertification(teamId)`

`packages/fe/src/app/Pages/MyProducts/useCanSeeCertification.ts` returns
`{ canSee: boolean; isLoading: boolean }`.

1. Waits for the team-level privilege cache and checks `team.sb-environment:read`.
2. Reads the team's environment menu list, `teamQueries.navSearchList({ teamId })`
   (`GET /teams/:teamId/env-nav`), the same list `TeamNav` uses.
3. Returns `canSee: true` when any row has `certifications: true`.

`isLoading` stays true until the team privilege cache and the menu list have arrived. On a cold page
load, a disabled TanStack query reports `isLoading === false`; without this, opening the page
directly showed "Not allowed" for a moment.

**One request, however many tenants.** Data store privileges are cached per tenant, and
`/auth/cache/:teamId` without a tenant leaves them out. A first version loaded
`/auth/cache/:teamId?edfiTenantId=…` once per tenant. That runs into the API's rate limit (100
requests a minute per client across all endpoints) for teams with many tenants, and with
`retry: false` the resulting 429s also broke normal tenant navigation. Instead, the API's
`env-nav` response now carries a `certifications` flag on each tenant row, computed from the user's
privilege cache like the existing `odss`, `edorgs` and other flags. Environment-only rows (no
tenant) always have `certifications: false`.

Both the menu and the page guard use this hook, so they can't disagree.

The decision is based on the privilege, not on the role name. Global admins viewing a team that
owns data stores see the menu too, because their global role holds the privilege. This is intended.

### Navigation

`packages/fe/src/app/Layout/TeamNav.tsx` shows a **Certification** heading between the main items
(Users, Integration Providers) and **Environments**. It shows only when `canSee` is true, and uses
the same style as the Environments heading.

The items under the heading come from a `certificationItems` array. Later stories add an entry to
it. For now it holds one item: **My products** (`Icons.CheckCircle`). The items are also in
`allItemsFlat`, so the menu highlights the active page.

### Route and page

- **Route:** `/as/:asId/my-products`, defined in `routes/certification-team.routes.tsx` and
  `paths.ts` (`myProducts.index`), and linked through `usePaths`.
- **Page:** `MyProductsPage` has the title "My products" and no content yet.
- **Loading:** it shows a spinner.
- **No access:** it throws `Error('Not allowed')`, which the routes' existing `ErrorFallback`
  shows. The front end has no dedicated 403 view, and this story doesn't add one.
- **Access check failed:** if the `env-nav` request fails (network error, 500), the hook returns
  that `error` and the page throws it, so `ErrorFallback` shows the real error instead of a false
  "Not allowed". The menu stays hidden in that case, like the other `TeamNav` sections whose
  requests fail.

## Not in scope

- What My products shows (AC-651, AC-671).
- Moving the Scenarios page and the certification controllers to the team privileges (AC-651).
- Removing "Request certification" from the global Environments list (AC-651).
- `config.showRequestCertification`. It is being removed, so the new menu and page don't read it.

## Known limitations

- **No error view if privileges fail to load.** If the team's `/auth/cache` request fails, My products
  shows a spinner instead of an error. The cause is the shared `usePrivilegeCacheForConfig` helper
  (`notifyOnChangeProps: ['data']`), which this story leaves unchanged.
