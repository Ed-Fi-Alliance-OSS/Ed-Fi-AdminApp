# AC-610 — Cap ODS/DataStore Name at 46 characters

- **Jira:** [AC-610](https://edfi.atlassian.net/browse/AC-610) (Epic: AC-506, Instance Management Integration - V2)
- **Date:** 2026-08-28
- **Status:** Approved

## Problem

When creating an ODS (Starting Blocks) or a Data Store (non-Starting Blocks) from
`packages/fe/src/app/Pages/Ods/CreateOdsPage.tsx`, the **Name** the user supplies is combined
with the selected **Template** by ODS-Admin-API to build the underlying database name:

```
EdFi_Ods_{normalizedName}_{databaseTemplate}
```

That name must fit the portable identifier ceiling shared by PostgreSQL (63 bytes) and
SQL Server. ODS-Admin-API enforces the ceiling, but only deep inside an async validator,
so an over-long name costs a server round-trip and surfaces as a late 400.

### Correcting the ticket's premise

The ticket states the Name field "has no maximum length restriction." That is not accurate.
`PostOdsDto.name` already carries `@MinLength(3) @MaxLength(29) @Matches(/^[A-Za-z0-9 _]+$/)`,
and `CreateOdsPage` uses `classValidatorResolver(PostOdsDto)` for *both* branches. Names over
46 characters are therefore already blocked today — at 29, stricter than the ticket asks.

`MaxLength(29)` dates to the initial public-repo import (`c0c7cb37`) with no recorded rationale.
This work therefore **raises** the cap from 29 to 46. That decision was made explicitly, with the
risk noted under [Open risk](#open-risk).

## Why 46

Both formatters build the same shape and normalize identically:

- `Application/EdFi.Ods.AdminApi/Features/OdsInstances/Manage/OdsInstanceManageDatabaseNameFormatter.cs` (V2)
- `Application/EdFi.Ods.AdminApi.V3/Features/DataStores/Manage/DataStoreManageDatabaseNameFormatter.cs` (V3)

| Segment | Length |
|---|---|
| `EdFi_Ods` prefix | 8 |
| Two `_` separators | 2 |
| Longest template (`Minimal`; `SandboxType` is `Minimal`\|`Sample`) | 7 |
| **Remaining for Name** | **46** |
| Total | **63** |

Normalization is never lengthening — spaces become underscores (length-preserving), the leading
canonical prefix is stripped, and `Trim('_')` only shortens. So 46 is a true ceiling, not an
approximation.

### Characters vs. bytes

PostgreSQL's limit is 63 *bytes*, while `@MaxLength` counts UTF-16 code units. The two coincide
only for ASCII. `PostOdsDto` guarantees ASCII through its existing
`@Matches(/^[A-Za-z0-9 _]+$/)`, so the form can never submit a name whose byte length exceeds its
character length. The V2/V3 instance DTOs deliberately do not mirror that pattern (see below), so
AdminApp's cap alone does not enforce the byte ceiling for a direct API caller — ODS-Admin-API's
own `_validOdsInstanceManageNamePattern` / `_validDataStoreManageNamePattern` reject non-ASCII
before any database is provisioned. The guarantee is therefore joint, not AdminApp's alone.

## Design

### 1. A single derived constant

New `packages/models/src/utils/ods-name-length.ts`, exported through the existing
`utils/index.ts` barrel so both the FE and the NestJS API reach it from `@edanalytics/models`:

```ts
/**
 * Mirrors MaxPortableDatabaseNameLength in ODS-Admin-API's
 * OdsInstanceManageDatabaseNameFormatter (V2) and
 * DataStoreManageDatabaseNameFormatter (V3).
 */
const MAX_PORTABLE_DATABASE_NAME_LENGTH = 63;
const CANONICAL_DATABASE_PREFIX = 'EdFi_Ods';   // 8
const LONGEST_DATABASE_TEMPLATE = 'Minimal';    // 7 — longest SandboxType value
const SEPARATOR_COUNT = 2;                      // EdFi_Ods _ name _ template

/** 63 - 8 - 2 - 7 = 46 */
export const MAX_ODS_NAME_LENGTH =
  MAX_PORTABLE_DATABASE_NAME_LENGTH -
  CANONICAL_DATABASE_PREFIX.length -
  SEPARATOR_COUNT -
  LONGEST_DATABASE_TEMPLATE.length;
```

Deriving rather than hardcoding `46` keeps the coupling to the AdminApi formatter auditable, and
a future longer `SandboxType` value tightens the cap automatically instead of silently breaking.

### 2. Validation — three DTO edits

| File | Change |
|---|---|
| `packages/models/src/dtos/ods.dto.ts` | `@MaxLength(29)` → `@MaxLength(MAX_ODS_NAME_LENGTH, { message })` on `PostOdsDto.name`. Reaches the form via `classValidatorResolver`, covering both `CreateOdsPage` branches. `@MinLength(3)` and `@Matches` unchanged. |
| `packages/models/src/dtos/edfi-admin-api.v2.dto.ts` | Add `@MaxLength(MAX_ODS_NAME_LENGTH, { message })` to `PostInstanceDtoV2.name`. |
| `packages/models/src/dtos/edfi-admin-api.v3.dto.ts` | Add the same to `PostInstanceDtoV3.name`. |

Shared message, exported from the same module as the constant so the two cannot drift:

```ts
export const MAX_ODS_NAME_LENGTH_MESSAGE =
  `Name must be ${MAX_ODS_NAME_LENGTH} characters or fewer so the generated database name ` +
  `stays within the ${MAX_PORTABLE_DATABASE_NAME_LENGTH}-character limit.`;
```

This requires exporting `MAX_PORTABLE_DATABASE_NAME_LENGTH` as well. The FE already renders the
message via `errors.name?.message`.

**Why the API DTOs too.** `PostInstanceDtoV2`/`V3` carry only `@IsString()` today, so
`POST /admin-api/{version}/instances` accepts any length from a non-UI caller. One FE query
(`instancesV2`) serves both V2 and V3 tenants — `builder.ts` routes on
`edfiTenant.sbEnvironment.version` — and both NestJS controllers expose `POST instances`. Adding
the rule to both DTOs is what makes this apply to V2 and V3.

Only `@MaxLength` is mirrored, not `@MinLength`/`@Matches`. Those would broaden the ticket and
risk rejecting request shapes that succeed today.

### 3. Form — input filter and character counter

In `CreateOdsPage.tsx`, add `watch` to the `useForm` destructure:

```tsx
const nameLength = watch('name')?.length ?? 0;
...
<Input {...register('name')} maxLength={MAX_ODS_NAME_LENGTH} />
<FormHelperText color={nameLength >= MAX_ODS_NAME_LENGTH ? 'red.500' : undefined}>
  {nameLength}/{MAX_ODS_NAME_LENGTH} characters
</FormHelperText>
```

`?? 0` because `defaultValues` leaves `name` undefined. Neutral until the cap, red at it — no
intermediate amber state. `register` emits only `{ name, onChange, onBlur, ref }`, so the spread
cannot clobber `maxLength`.

`maxLength` is an input filter, not validation: it stops the DOM from ever holding more than 46
characters. Browsers apply it to paste as well as typing, so an over-long pasted name is
truncated silently. The counter exists to make that truncation visible. The DTO rule remains the
actual enforcement and still fires for any non-UI caller.

Conventions followed: `FormHelperText` is already used in `CopyClaimset.tsx`, and `red.500` is
already used for text in `CreateOdsPage.tsx`.

### 4. Tests

- `packages/models/src/dtos/ods.dto.spec.ts` (extend existing pattern): 46 accepted, 47 rejected.
- Matching cases in `edfi-admin-api.v2.dto.spec.ts` and `edfi-admin-api.v3.dto.spec.ts`.
- **Contract guard:** assert `MAX_ODS_NAME_LENGTH === 46` *and* that
  `'EdFi_Ods_' + 'x'.repeat(46) + '_Minimal'` is exactly 63 characters. This is the assertion
  that pins AdminApp to the AdminApi formatter — if either side drifts, it fails.

## Out of scope

- The rename/PUT paths and `PutOdsDto.name`, which has no length rule either. AC-610 is
  create-only.
- ODS-Admin-API's own `MaxOdsInstanceManageNameLength = 100` and its async 63-character check.
  Those stay as the server-side backstop; this is an AdminApp-side change.
- Data migration. Names of 30–46 characters cannot exist, since 29 was the prior cap.

## Starting Blocks: known gap, accepted

No rationale for the original `MaxLength(29)` exists in code, tests, or git history. If Starting
Blocks provisioning enforces its own naming limit outside this repository, a 30–46 character SB
name would fail at creation time and nothing in this repository would catch it. It cannot be
settled from this codebase.

The gap is sharper than it first appears: the Starting Blocks branch never reaches the AdminApi
formatter at all. `odss.service.ts` routes it to `startingBlocksServiceV2.createOds`, so for SB
users the 46 cap — and its message about the generated database name — is justified by a
constraint that does not govern their flow. The number is not *wrong* for them (46 is looser than
the 29 they had), but it has no verified basis on that side.

**Decision (2026-08-28): accepted, not fixed.** Starting Blocks support is slated for removal, so
the team chose not to make the cap branch-aware for a flow that is being retired. AC-610 was
scoped as a small change and stays that way. Nothing regresses for SB users — 46 is looser than
the 29 they had, so no name that worked before stops working.

If SB support outlives this decision and turns out to need its own limit, the fix is a separate
ticket and the shape is known: the two flows are already fully separated server-side
(`PostOdsDto` via `POST .../odss` for SB; `PostInstanceDtoV2`/`V3` via
`POST .../admin-api/{version}/instances` for the rest), so only the shared form resolver in
`CreateOdsPage` needs splitting. Note that class-validator unions parent and child rules, so a
subclass can only tighten a cap, never relax one — two standalone form DTOs are required, not
inheritance.

## Verification

- `npm run test:api`, `npm run test:fe`
- `npm run build` (required by AGENTS.md before submitting changes)
