# AC-642: Prevent mass assignment through unfiltered DTOs

- **Jira:** [AC-642](https://edfi.atlassian.net/browse/AC-642)
- **Date:** 2026-10-01
- **Status:** Implemented

## Problem

The API registers one global NestJS `ValidationPipe` in `packages/api/src/main.ts`. Every
class-typed `@Body()` or `@Query()` parameter goes through it: the plain JSON body is turned
into an instance of the DTO class with class-transformer, then checked with class-validator.

The pipe was configured like this:

```ts
new ValidationPipe({ transform: true, stopAtFirstError: false, exceptionFactory: ... })
```

It had no `whitelist` and no `transformOptions`. By default class-transformer's
`plainToInstance` **keeps every property in the input**, including ones the DTO doesn't
declare. So a controller typed as `@Body() dto: PostTeamDto` could receive
`{ "name": "x", "id": 7, "modifiedById": 1 }` with all three properties intact.

Several create methods then pass that object straight to TypeORM:

```ts
return this.repository.save(this.repository.create(dto));
```

`repository.create()` copies every property that matches an entity column, and `id` is a
column. `repository.save()` treats an entity with a primary key as an update. **A request to
a create endpoint can therefore overwrite an existing row** by including its `id`.

### Impact

| Create endpoint (controller) | Privilege needed | Effect of an injected `id` |
|---|---|---|
| Team-scoped memberships (`teams/user-team-memberships/user-team-memberships.controller.ts`) | `team.user-team-membership:create` on *own* team | **Cross-team.** The controller replaces `teamId` with the route value, but `id` survives. The caller can take any membership row, move it into their own team and set its `userId`/`roleId`. |
| Global memberships (`user-team-memberships-global.controller.ts`) | global | Overwrite any membership |
| Users (`users-global.controller.ts`) | global | Overwrite any user (username, role, active flag) |
| Teams (`teams-global.controller.ts`) | global | Rename any team |
| Integration providers (`integration-providers-global.controller.ts`) | `integration-provider:create` (global) | Overwrite any integration provider |

The team-scoped membership endpoint is the serious case: a user who administers one team
can affect another team's data. The other endpoints already need global admin privileges.

Besides `id`, a client could set `modifiedById`, `created` and `modified` on these rows.
`createdById` couldn't be forged: `addUserCreating` overwrites it after the pipe runs.

### Corrections to the ticket

- "The pipe" is the global `ValidationPipe` described above.
- The ticket's `teamId` example doesn't work on the team-scoped membership endpoint, because
  the route value overwrites it. The `id` attack on the same endpoint does work and is worse.
- Some cited call sites aren't reachable with a client-controlled body:
  - `integration-apps-team.service.ts`: its only callers (Starting Blocks v2 and v3
    controllers) build the payload from explicit fields.
  - `edfi-tenants-global.service.ts`: both tenant create endpoints go through the Starting
    Blocks `createTenant` path, which builds the row field by field.
  - `teams/sb-environments/sb-environments.service.ts`: `create()` isn't called by any
    controller.
- The suggested `whitelist: true` + `forbidNonWhitelisted: true` would have broken requests.
  `whitelist` keeps only properties with a **class-validator** decorator; `@Expose()` doesn't
  count. Several DTOs (for example `PostIntegrationAppDto` and the Admin API claimset and
  resource-claim DTOs) have `@Expose()` fields with no validator.

## Fix

### 1. Filter request bodies to `@Expose()`d properties

The pipe now lives in `packages/api/src/app/global-validation-pipe.ts` so it can be unit
tested, and `main.ts` calls `createGlobalValidationPipe()`:

```ts
new ValidationPipe({
  transform: true,
  transformOptions: {
    excludeExtraneousValues: true,
    exposeUnsetFields: false,
  },
  stopAtFirstError: false,
  exceptionFactory: ..., // unchanged
});
```

- **`excludeExtraneousValues: true`** keeps only properties marked `@Expose()`. Server-managed
  fields on the base DTOs are deliberately *not* exposed (`DtoPostBase.createdById`,
  `DtoPutBase.id`, `DtoPutBase.modifiedById`), so they are now dropped. The response side
  already uses the same option (`ClassSerializerInterceptor` in `main.ts`), so request and
  response handling now follow one rule.
- **`exposeUnsetFields: false`** is required, not optional. Without it, class-transformer sets
  every exposed property the client didn't send to `undefined` as an own property.
  `applyDtoUpdates` checks `hasOwnProperty`, so a partial PUT would then write `undefined`
  over existing values. With this flag, unsent properties stay absent, exactly as before.

Nested DTOs keep working. Properties with `@Type(() => X)` are filtered against `X`'s
`@Expose()` list. Nested objects without `@Type` pass through unchanged, because
class-transformer only filters when it knows the target class.

The `exceptionFactory` and error response shape are unchanged.

`whitelist` and `forbidNonWhitelisted` were **not** enabled, for the reasons under
[Corrections to the ticket](#corrections-to-the-ticket). Requests with extra properties
still succeed; the extra properties are just dropped. This avoids breaking frontend forms
that send fields such as `id` or `displayName` alongside the real payload.

### 2. Defence in depth at create call sites

A new helper, `withoutId()` (`packages/api/src/utils/withoutId.ts`), returns a shallow copy
of a payload without `id`. It is applied at every create method that passes a request DTO
straight into `repository.create()`:

- `users-global/users-global.service.ts`
- `teams/teams-global.service.ts`
- `edfi-tenants-global/edfi-tenants-global.service.ts`
- `teams/sb-environments/sb-environments.service.ts`
- `user-team-memberships-global/user-team-memberships-global.service.ts`
- `teams/user-team-memberships/user-team-memberships.service.ts`
- `integration-providers-global/integration-providers-global.controller.ts`

This keeps those methods safe if a DTO later gains an exposed `id`, or if a service is called
with an object that didn't go through the pipe. The tenant and Starting Blocks environment
services aren't reachable with a client-controlled body today, but they get the helper too
because their `create()` methods have the same shape.

Roles and ownerships were already safe: their services build the entity field by field.

### 3. Profile updates take the id from the route

`PUT .../admin-api/v2|v3/profiles/:profileId` forwarded the request body to Admin API as-is,
including any client-supplied `id`. `PutProfileDtoV2`/`V3.id` isn't exposed, so the pipe now
strips it. The v2 and v3 controllers now set `id` from the `profileId` route parameter
(`{ ...profile, id: profileId }`), so Admin API still receives an `id`, and it always matches
the URL.

## Compatibility audit

`excludeExtraneousValues` silently drops any field without `@Expose()`, so every DTO bound
with `@Body()` or `@Query()` was audited before the change. A TypeScript-AST script walked
all `@Body()`/`@Query()` parameters in `packages/api/src`, resolved each DTO class in
`packages/models` and `packages/models-server`, followed `extends` chains and `@Type()`
nested classes, and listed every property without `@Expose()` or `@Exclude()`.

There are 53 bound DTO classes, and `@Query()` is only used with primitive types. The only
unexposed properties were:

| Property | Where | Read by the server from the body? |
|---|---|---|
| `createdById` | `DtoPostBase` | No; set by `addUserCreating` |
| `id`, `modifiedById` | `DtoPutBase` | No; updates use the route parameter, and `modifiedById` is set server-side by `addUserModifying` |
| `id`, `modifiedById` | `PutEdfiTenantAdminApi`, `PutEdfiTenantAdminApiRegister`, `PutSbEnvironmentMeta` | No |
| `id` | `PutApplicationFormDtoV2`/`V3` | No; the controller builds the Admin API payload explicitly with `plainToInstance` |
| `id` | `PutProfileDtoV2`/`V3` | Forwarded to Admin API; now set from the route (see fix 3) |

No other client-supplied field changes behaviour.

## Tests

- `packages/api/src/app/global-validation-pipe.spec.ts` runs the real pipe against real DTOs:
  - an injected `id` is stripped from `PostUserTeamMembershipDto`
  - `createdById`, `modifiedById` and undeclared properties are stripped from `PostTeamDto`
  - unsent optional fields stay absent on `PutUserTeamMembershipDto` (guards the
    `exposeUnsetFields` setting)
  - exposed nested properties survive on `ImportClaimsetSingleDtoV2`, and unexposed nested
    ones are dropped
  - invalid bodies are still rejected with `CustomHttpException`
- `packages/api/src/utils/withoutId.spec.ts` covers the helper.
- `user-team-memberships-global.service.spec.ts` has a regression test: `create()` with an
  `id` never passes that `id` to `repository.create()` or `save()`.

## Possible follow-up

- **Enable `whitelist: true`** after adding a class-validator decorator (at least
  `@Allow()`) to every exposed DTO field. This would add a second, validator-based filter.
  Only consider `forbidNonWhitelisted` after checking the frontend payloads, since it turns
  today's silent stripping into 400 errors.
- **Add a lint or unit check** that fails when a bound DTO property lacks `@Expose()`. That
  would catch new fields that would otherwise be silently dropped.
