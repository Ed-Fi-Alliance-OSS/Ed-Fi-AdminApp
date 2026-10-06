# AC-644: Privilege delegation trust model

- **Jira:** [AC-644](https://edfi.atlassian.net/browse/AC-644)
- **Date:** 2026-10-06
- **Status:** Implemented

## Problem

Role definition and role assignment checked only that privilege codes existed. They never
checked that the caller held the privileges being granted.

- A user with `team.role:create` and `team.user-team-membership:create` in a team could mint
  a role carrying every `team.*` privilege and assign it to themselves.
- Globally, `role:create` together with `user-team-membership:create` or `user:update` was a
  path to full administrator.

The ticket asked for the trust model to be explicit either way. This document states it.

## The rule

**A caller can only grant privileges they hold.**

This applies to every way of granting a privilege to a user:

| Action | Endpoint service | What is checked |
|---|---|---|
| Define a team role | `RolesService.create` / `update` | The role's privileges |
| Define a global role | `RolesGlobalService.create` / `update` | The role's privileges |
| Assign a team role | `UserTeamMembershipsService.create` / `update` | The assigned role's privileges |
| Assign a team role (global admin screens) | `UserTeamMembershipsGlobalService.create` / `update` | The assigned role's privileges |
| Assign a global role | `UsersGlobalService.create` / `update` | The assigned role's privileges |

All of them call `PrivilegeGrantGuardService`
(`packages/api/src/auth/authorization/privilege-grant-guard.service.ts`).

There is **no bypass privilege**. A "delegate anything" privilege was considered and left
out. If unrestricted delegation is ever needed, it should be a new, explicit privilege.

### Only additions are checked

Only privileges that are being **newly granted** must be held:

- **Creating a role:** every privilege on the role.
- **Editing a role:** only privileges added to it. Renaming a role, editing its description
  or removing privileges is always allowed, even if the role holds privileges the editor
  lacks.
- **Assigning a role:** only privileges the new role adds compared with the user's previous
  role. Demoting a user, or moving them to a role with a subset of their current privileges,
  is always allowed.
  - The previous role only counts if it was itself valid for the context (a `UserTeam` role
    of that team, or a public team role, for memberships; a `UserGlobal` role for users).
    A role assigned improperly in the past cannot vouch for its own privileges.
  - If the previous role no longer exists, the new role is checked in full.
- **Unassigning a role** (setting `roleId` to `null`) and leaving it unchanged are never
  checked.

The rule is about escalation only. It does not stop a less-privileged user from demoting or
removing a more-privileged one. That is a separate policy and is out of scope.

### What "held" means

Held privileges come from `AuthService.getUserPrivileges(userId, teamId?)`:

- the privileges of the caller's **global** role, plus
- when a team is given, the `team.*` privileges of the caller's role **in that team**.

The privileges are the raw codes on those roles. They are not narrowed by what the team
owns: the team-ownership intersection decides what a privilege lets a user *do*, not what
they may delegate.

Which team is used depends on the endpoint:

| Endpoint | Team used |
|---|---|
| Team routes (`/teams/:teamId/...`) | The route's team |
| Global membership routes | The membership's team |
| Global role and global user routes | **None** |

So on the **global role endpoint**, team privileges count only if they are on the caller's
global role. Team privileges the caller holds only through a team membership do not count,
even when the role being defined belongs to that team. This is deliberately conservative.
It is pinned by `privilege-escalation.spec.ts`.

### Responses

- **403 Insufficient privileges** when the caller lacks a privilege being granted. The
  message names up to three missing privileges by description and summarises the rest. The
  full list of codes is logged as a warning, with the caller's id and the target.
- **400** on `roleId` when the role being assigned is not valid for the context: it does not
  exist, has the wrong type, or belongs to another team. A missing role gets the same 400 as
  an invalid one, so the response does not reveal which role ids exist.
- Existing validation (unknown privilege codes, the `me:read` floor on global roles,
  duplicate memberships) runs first and keeps its own errors.

## Global admin must hold every privilege

Because of the rule, the seeded **Global admin** role (id 2) can only grant what it holds.
It was seeded with every privilege that existed at the time, but later migrations added new
privileges only to other roles. Without a fix, Global admins could not assign the seeded
Tenant admin role.

Migration `AddMissingPrivilegesToGlobalAdmin1791158400000` (PostgreSQL and SQL Server)
gives role 2 every current privilege, if role 2 is a `UserGlobal` role. It uses a frozen
snapshot of the privilege codes, is safe to run twice, and its `down` does nothing.

### Requirement when adding a privilege

**Every new privilege needs a migration that adds it to the Global admin role (id 2).**
Otherwise Global admins cannot grant it.

The tripwire test `packages/models/src/types/privilege-snapshot.spec.ts` enforces this: it
fails whenever the privilege list changes, with a message saying to write the migration and
then update the snapshot.

Deployments with **custom** admin-like global roles must make sure those roles hold every
privilege they are expected to delegate.

## Known limits

- **Check, then save.** The privilege check and the write are not in one transaction. If the
  caller is demoted in the milliseconds between them, that one grant can still complete. This
  is accepted: the caller held the privileges when the request was authorized.
- **Ownerships.** Assigning a `ResourceOwnership` role to a team (`ownership:create` /
  `ownership:update`) is not covered by this rule. It is tracked in
  [AC-674](https://edfi.atlassian.net/browse/AC-674).
