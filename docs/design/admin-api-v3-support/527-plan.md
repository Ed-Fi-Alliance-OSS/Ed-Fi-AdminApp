# AC-527 Vendor Management V3 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give V3-specification tenants the same Vendor list/create/view/edit/delete experience V2 tenants already have, by making the existing V2 Vendor surface version-aware instead of duplicating it.

**Architecture:** Add a `vendorQueriesV3` query builder next to the existing `vendorQueriesV2`, add a small generic `createVersionedResource` factory that resolves a per-version config object (queries + DTO classes) from the tenant's `sbEnvironment.version`, rename `Pages/VendorV2` to `Pages/VendorV2Plus`, and swap each component's hardcoded `vendorQueriesV2`/DTO-class references for the resolved config. Wire `v3` into the existing `VersioningHoc` route branches alongside `v2`, pointing at the same components.

**Tech Stack:** React, TypeScript, react-query, react-hook-form + `@hookform/resolvers/class-validator`, Chakra UI, Jest (existing patterns — no new npm packages).

## Global Constraints

- No new npm packages — implement with the existing query-builder pattern, react-query, Chakra UI, react-hook-form, and `classValidatorResolver` already in use (per 527.md constraints).
- No changes to V1 Vendor pages/behavior, and no behavior change to V2 Vendor pages/behavior — this is an internal refactor plus a new V3 path (per 527.md scope boundaries).
- No other V3 entity (Application, Claimset, Profile, ApiClient) is in scope — those are AC-528/529/530.
- Follow existing repo conventions: Jest with `jest.mock(...)` for module dependencies (see `useSyncEdOrgsAction.spec.tsx`, `CreateOdsPage.spec.tsx` for the established pattern), `import 'reflect-metadata';` at the top of any spec that touches a class-transformer-decorated DTO directly (not needed when the DTO is only referenced through a mocked module).
- Test command for this package: `npx nx run fe:test -- --testPathPattern "<path-fragment>"` (run from repo root). Full suite: `npx nx run fe:test`.
- There is no `fe:typecheck` nx target in this repo. Use `npx nx run fe:build` to verify TypeScript compiles cleanly.

---

### Task 1: Add `vendorQueriesV3` query builder

**Files:**
- Modify: `packages/fe/src/app/api/queries/queries.v7.ts`

**Interfaces:**
- Consumes: `EntityQueryBuilder` from `packages/fe/src/app/api/queries/builder.ts` (existing), `TeamOptions` (existing), `GetVendorDtoV3`, `PostVendorDtoV3`, `PutVendorDtoV3` from `@edanalytics/models` (already exist from AC-524 backend work, in `packages/models/src/dtos/edfi-admin-api.v3.dto.ts`, already exported via `packages/models/src/dtos/index.ts`).
- Produces: `vendorQueriesV3` — same shape as `vendorQueriesV2` (`getOne`, `getAll`, `put`, `post`, `delete`), re-exported from `packages/fe/src/app/api/index.ts` (via the existing `export * from './queries'` chain — no index changes needed). Later tasks import it as `vendorQueriesV3` from `'../../api'`.

This mirrors the existing `vendorQueriesV2` declaration exactly, swapping the DTO classes. There is no branching logic to unit test here (same as `vendorQueriesV2` itself has no dedicated test) — verification is via TypeScript compilation and Task 4's usage.

- [ ] **Step 1: Add the `GetVendorDtoV3`/`PostVendorDtoV3`/`PutVendorDtoV3` import**

In `packages/fe/src/app/api/queries/queries.v7.ts`, find the import block that includes `GetVendorDtoV2, PostVendorDtoV2, PutVendorDtoV2` (near the top of the file) and add the V3 equivalents to the same `@edanalytics/models` import statement:

```ts
import {
  // ...existing imports...
  GetVendorDtoV2,
  PostVendorDtoV2,
  PutVendorDtoV2,
  GetVendorDtoV3,
  PostVendorDtoV3,
  PutVendorDtoV3,
  // ...existing imports...
} from '@edanalytics/models';
```

- [ ] **Step 2: Add the `vendorQueriesV3` builder**

Immediately after the existing `vendorQueriesV2` declaration (around line 219-230 of `queries.v7.ts`), add:

```ts
export const vendorQueriesV3 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Vendor',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .getOne('getOne', { ResDto: GetVendorDtoV3 })
  .getAll('getAll', { ResDto: GetVendorDtoV3 })
  .put('put', { ResDto: GetVendorDtoV3, ReqDto: PutVendorDtoV3 })
  .post('post', { ResDto: Id, ReqDto: PostVendorDtoV3 })
  .delete('delete')
  .build();
```

(`Id` is already imported in this file for `vendorQueriesV2`'s `post` call — no new import needed for it.)

- [ ] **Step 3: Typecheck**

Run: `npx nx run fe:build`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/fe/src/app/api/queries/queries.v7.ts
git commit -m "feat: add vendorQueriesV3 query builder"
```

---

### Task 2: Create the `createVersionedResource` factory

**Files:**
- Create: `packages/fe/src/app/api/queries/versioned.ts`
- Test: `packages/fe/src/app/api/queries/versioned.spec.ts`

**Interfaces:**
- Consumes: `useTeamEdfiTenantNavContextLoaded` from `packages/fe/src/app/helpers` (existing; returns an object with `edfiTenant: { sbEnvironment: { version: 'v1' | 'v2' | 'v3' | undefined } }` among other fields).
- Produces: `createVersionedResource<Config>(byVersion: Partial<Record<'v2' | 'v3', Config>>): () => Config` — a factory that returns a hook. Later tasks (Task 4) call this to build `useVendorConfig`. This is the reusable piece AC-528/529/530 will import directly.

- [ ] **Step 1: Write the failing test**

Create `packages/fe/src/app/api/queries/versioned.spec.ts`:

```ts
jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { createVersionedResource } from './versioned';

const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;

const setVersion = (version: 'v1' | 'v2' | 'v3' | undefined) => {
  mockUseNavContext.mockReturnValue({ edfiTenant: { sbEnvironment: { version } } });
};

describe('createVersionedResource', () => {
  afterEach(() => jest.clearAllMocks());

  const useResource = createVersionedResource({ v2: 'v2-resource', v3: 'v3-resource' });

  it('returns the v2 resource when the tenant is on v2', () => {
    setVersion('v2');
    expect(useResource()).toBe('v2-resource');
  });

  it('returns the v3 resource when the tenant is on v3', () => {
    setVersion('v3');
    expect(useResource()).toBe('v3-resource');
  });

  it('throws when the resolved version has no mapped resource', () => {
    setVersion('v1');
    expect(() => useResource()).toThrow('No resource registered for admin API version "v1"');
  });

  it('throws when version is undefined', () => {
    setVersion(undefined);
    expect(() => useResource()).toThrow('No resource registered for admin API version "undefined"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run fe:test -- --testPathPattern "api/queries/versioned.spec.ts"`
Expected: FAIL — `Cannot find module './versioned'`

- [ ] **Step 3: Write the implementation**

Create `packages/fe/src/app/api/queries/versioned.ts`:

```ts
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

export type VersionedResourceKey = 'v2' | 'v3';

/**
 * Build a hook that resolves a per-admin-api-version config object (queries,
 * DTO classes, whatever a page needs) from the current tenant's resolved
 * version. V1 is intentionally excluded — this is for the "V2 and later"
 * pattern only.
 */
export function createVersionedResource<Config>(
  byVersion: Partial<Record<VersionedResourceKey, Config>>
) {
  return function useVersionedResource(): Config {
    const { edfiTenant } = useTeamEdfiTenantNavContextLoaded();
    const version = edfiTenant.sbEnvironment.version;
    const resource = version ? byVersion[version as VersionedResourceKey] : undefined;
    if (!resource) {
      throw new Error(`No resource registered for admin API version "${version}"`);
    }
    return resource;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run fe:test -- --testPathPattern "api/queries/versioned.spec.ts"`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/fe/src/app/api/queries/versioned.ts packages/fe/src/app/api/queries/versioned.spec.ts
git commit -m "feat: add createVersionedResource factory for version-aware pages"
```

---

### Task 3: Rename `Pages/VendorV2` to `Pages/VendorV2Plus`

**Files:**
- Rename (git mv): `packages/fe/src/app/Pages/VendorV2/CreateVendorPage.tsx` → `packages/fe/src/app/Pages/VendorV2Plus/CreateVendorPage.tsx`
- Rename (git mv): `packages/fe/src/app/Pages/VendorV2/EditVendor.tsx` → `packages/fe/src/app/Pages/VendorV2Plus/EditVendor.tsx`
- Rename (git mv): `packages/fe/src/app/Pages/VendorV2/NameCell.tsx` → `packages/fe/src/app/Pages/VendorV2Plus/NameCell.tsx`
- Rename (git mv): `packages/fe/src/app/Pages/VendorV2/useVendorActions.tsx` → `packages/fe/src/app/Pages/VendorV2Plus/useVendorActions.tsx`
- Rename (git mv): `packages/fe/src/app/Pages/VendorV2/VendorPage.tsx` → `packages/fe/src/app/Pages/VendorV2Plus/VendorPage.tsx`
- Rename (git mv): `packages/fe/src/app/Pages/VendorV2/VendorsPage.tsx` → `packages/fe/src/app/Pages/VendorV2Plus/VendorsPage.tsx`
- Rename (git mv): `packages/fe/src/app/Pages/VendorV2/ViewVendor.tsx` → `packages/fe/src/app/Pages/VendorV2Plus/ViewVendor.tsx`
- Modify: `packages/fe/src/app/routes/vendor.routes.tsx` (update the 3 import paths that currently read `'../Pages/VendorV2/...'`)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new. This is a pure move — no exported symbol names change (e.g. `VendorPageV2`, `VendorsPageV2`, `CreateVendorV2` keep their existing names; only the folder path changes). Tasks 4-9 all reference files at their new `VendorV2Plus` path.

None of these 7 files have their own `.spec.tsx` test files today (confirmed: no existing spec files reference `VendorV2` or `vendorQueriesV2`), so this task has no unit tests to move. Verification is via typecheck and the full test suite (to catch any other file that imports from the old path).

- [ ] **Step 1: Move the folder**

```bash
git mv packages/fe/src/app/Pages/VendorV2 packages/fe/src/app/Pages/VendorV2Plus
```

- [ ] **Step 2: Update imports in `vendor.routes.tsx`**

In `packages/fe/src/app/routes/vendor.routes.tsx`, change:

```ts
import { VendorPageV2 } from '../Pages/VendorV2/VendorPage';
import { VendorsPageV2 } from '../Pages/VendorV2/VendorsPage';
import { CreateVendorV2 } from '../Pages/VendorV2/CreateVendorPage';
```

to:

```ts
import { VendorPageV2 } from '../Pages/VendorV2Plus/VendorPage';
import { VendorsPageV2 } from '../Pages/VendorV2Plus/VendorsPage';
import { CreateVendorV2 } from '../Pages/VendorV2Plus/CreateVendorPage';
```

- [ ] **Step 3: Search for any other references to the old path**

Run: `grep -rn "Pages/VendorV2/" packages/fe/src`
Expected: no results (empty output). If any appear, update them the same way as Step 2.

- [ ] **Step 4: Typecheck and run the full frontend test suite**

Run: `npx nx run fe:build && npx nx run fe:test`
Expected: no errors; all existing tests still pass (this is a pure move, nothing should break).

- [ ] **Step 5: Commit**

```bash
git add -A packages/fe/src/app/Pages/VendorV2Plus packages/fe/src/app/routes/vendor.routes.tsx
git commit -m "refactor: rename Pages/VendorV2 to Pages/VendorV2Plus"
```

---

### Task 4: Create `vendorConfig.ts`

**Files:**
- Create: `packages/fe/src/app/Pages/VendorV2Plus/vendorConfig.ts`

**Interfaces:**
- Consumes: `createVersionedResource` from `packages/fe/src/app/api/queries/versioned.ts` (Task 2), `vendorQueriesV2`/`vendorQueriesV3` from `packages/fe/src/app/api` (existing / Task 1), `GetVendorDtoV2`, `PostVendorDtoV2`, `PutVendorDtoV2`, `GetVendorDtoV3`, `PostVendorDtoV3`, `PutVendorDtoV3` from `@edanalytics/models`.
- Produces:
  - `useVendorConfig(): VendorConfig` where `VendorConfig = { version: 'v2' | 'v3'; queries: typeof vendorQueriesV2 | typeof vendorQueriesV3; PostDto: typeof PostVendorDtoV2 | typeof PostVendorDtoV3; PutDto: typeof PutVendorDtoV2 | typeof PutVendorDtoV3 }`.
  - `type VendorEntity = GetVendorDtoV2 | GetVendorDtoV3` — the shared "vendor read model" type later tasks use in place of the hardcoded `GetVendorDtoV2` type annotation (the fields are identical across both, so this is safe).

This file is declarative wiring (like `queries.v7.ts`) with no branching logic of its own — `createVersionedResource` (Task 2) already has its own unit tests covering the branching behavior. Verification here is via typecheck and via Tasks 5-8's component tests, which mock this module.

- [ ] **Step 1: Write the file**

Create `packages/fe/src/app/Pages/VendorV2Plus/vendorConfig.ts`:

```ts
import {
  GetVendorDtoV2,
  GetVendorDtoV3,
  PostVendorDtoV2,
  PostVendorDtoV3,
  PutVendorDtoV2,
  PutVendorDtoV3,
} from '@edanalytics/models';
import { vendorQueriesV2, vendorQueriesV3 } from '../../api';
import { createVersionedResource } from '../../api/queries/versioned';

export type VendorEntity = GetVendorDtoV2 | GetVendorDtoV3;

export const useVendorConfig = createVersionedResource({
  v2: {
    version: 'v2' as const,
    queries: vendorQueriesV2,
    PostDto: PostVendorDtoV2,
    PutDto: PutVendorDtoV2,
  },
  v3: {
    version: 'v3' as const,
    queries: vendorQueriesV3,
    PostDto: PostVendorDtoV3,
    PutDto: PutVendorDtoV3,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx nx run fe:build`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add packages/fe/src/app/Pages/VendorV2Plus/vendorConfig.ts
git commit -m "feat: add useVendorConfig version-aware vendor resource config"
```

---

### Task 5: Update `useVendorActions.tsx` to use `useVendorConfig`

**Files:**
- Modify: `packages/fe/src/app/Pages/VendorV2Plus/useVendorActions.tsx`
- Test: `packages/fe/src/app/Pages/VendorV2Plus/useVendorActions.spec.tsx`

**Interfaces:**
- Consumes: `useVendorConfig` and `VendorEntity` from `./vendorConfig` (Task 4).
- Produces: `useVendorActions(vendor: VendorEntity | undefined): ActionsType` and `useManyVendorActions(): ActionsType` — same exported names and shapes as before, just no longer hardcoded to `vendorQueriesV2`/`GetVendorDtoV2`. Task 8's `NameCell.tsx` continues to call `useVendorActions` unchanged.

- [ ] **Step 1: Write the failing test**

Create `packages/fe/src/app/Pages/VendorV2Plus/useVendorActions.spec.tsx`:

```tsx
import 'reflect-metadata';
import { useVendorActions, useManyVendorActions } from './useVendorActions';

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../helpers', () => ({
  useAuthorize: jest.fn(() => true),
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
  vendorAuthConfig: jest.fn((edfiTenantId, teamId, privilege) => ({
    privilege,
    subject: { edfiTenantId, teamId },
  })),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('./vendorConfig', () => ({
  useVendorConfig: jest.fn(),
}));

import { useNavigate } from 'react-router-dom';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useVendorConfig } from './vendorConfig';

const mockUseNavigate = useNavigate as jest.Mock;
const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockUseVendorConfig = useVendorConfig as jest.Mock;

const buildVendor = () => ({ id: 5, displayName: 'Acme Co' });

const setup = (version: 'v2' | 'v3') => {
  const deleteMutateAsync = jest.fn().mockResolvedValue(undefined);
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseNavContext.mockReturnValue({
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
    edfiTenantId: 3,
    asId: 1,
  });
  mockUseVendorConfig.mockReturnValue({
    version,
    queries: { delete: jest.fn(() => ({ isPending: false, mutateAsync: deleteMutateAsync })) },
  });
  return { deleteMutateAsync };
};

describe('useVendorActions', () => {
  afterEach(() => jest.clearAllMocks());

  it('reads the delete mutation from useVendorConfig().queries for a v2 tenant', () => {
    const { deleteMutateAsync } = setup('v2');

    const actions = useVendorActions(buildVendor());
    actions.Delete!.onClick();

    expect(deleteMutateAsync).toHaveBeenCalledWith(
      { id: 5 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('reads the delete mutation from useVendorConfig().queries for a v3 tenant', () => {
    const { deleteMutateAsync } = setup('v3');

    const actions = useVendorActions(buildVendor());
    actions.Delete!.onClick();

    expect(deleteMutateAsync).toHaveBeenCalledWith(
      { id: 5 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('returns an empty object for useManyVendorActions when create is unauthorized', () => {
    setup('v2');
    jest.requireMock('../../helpers').useAuthorize.mockReturnValue(false);

    expect(useManyVendorActions()).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run fe:test -- --testPathPattern "VendorV2Plus/useVendorActions.spec.tsx"`
Expected: FAIL — the current implementation imports `vendorQueriesV2` from `'../../api'` directly rather than calling `useVendorConfig()`, so `mockUseVendorConfig` is never invoked and `deleteMutateAsync` is never called the way the test expects (the real, unmocked `vendorQueriesV2.delete` will be invoked instead, likely throwing or returning `undefined` and breaking the assertion).

- [ ] **Step 3: Update the implementation**

In `packages/fe/src/app/Pages/VendorV2Plus/useVendorActions.tsx`, replace:

```ts
import { GetVendorDtoV2 } from '@edanalytics/models';
import { vendorQueriesV2 } from '../../api';
```

with:

```ts
import { VendorEntity, useVendorConfig } from './vendorConfig';
```

Replace the `useVendorActions` signature and body's query usage:

```ts
export const useVendorActions = (vendor: VendorEntity | undefined): ActionsType => {
  const { edfiTenant, edfiTenantId, asId } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useVendorConfig();

  const navigate = useNavigate();
  const to = (id: number | string) =>
    `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/vendors/${id}`;
  const deleteVendor = queries.delete({ edfiTenant, teamId: asId });
  // ...rest of the function body is unchanged...
```

(Leave `useManyVendorActions` as-is — it doesn't touch `vendorQueriesV2` at all.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run fe:test -- --testPathPattern "VendorV2Plus/useVendorActions.spec.tsx"`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/fe/src/app/Pages/VendorV2Plus/useVendorActions.tsx packages/fe/src/app/Pages/VendorV2Plus/useVendorActions.spec.tsx
git commit -m "feat: make useVendorActions version-aware via useVendorConfig"
```

---

### Task 6: Update `CreateVendorPage.tsx` to use `useVendorConfig`

**Files:**
- Modify: `packages/fe/src/app/Pages/VendorV2Plus/CreateVendorPage.tsx`
- Test: `packages/fe/src/app/Pages/VendorV2Plus/CreateVendorPage.spec.tsx`

**Interfaces:**
- Consumes: `useVendorConfig` from `./vendorConfig` (Task 4).
- Produces: `CreateVendorV2` (name unchanged) — now posts through whichever `queries`/`PostDto` the tenant's version resolves to.

- [ ] **Step 1: Write the failing test**

Create `packages/fe/src/app/Pages/VendorV2Plus/CreateVendorPage.spec.tsx` (following the existing `CreateOdsPage.spec.tsx` pattern):

```tsx
import 'reflect-metadata';
import { CreateVendorV2 } from './CreateVendorPage';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useVendorConfig } from './vendorConfig';

jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
  Icons: { InfoCircle: () => null },
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('react-hook-form', () => ({
  useForm: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));

jest.mock('@hookform/resolvers/class-validator', () => ({
  classValidatorResolver: jest.fn((Dto) => Dto),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../helpers', () => ({
  useNavToParent: jest.fn(() => '/parent'),
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('./vendorConfig', () => ({
  useVendorConfig: jest.fn(),
}));

const mockUseForm = useForm as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockUseNavToParent = useNavToParent as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockUseVendorConfig = useVendorConfig as jest.Mock;

const getFormElement = () => {
  const result = CreateVendorV2() as React.ReactElement;
  return result.props.children.props.children as React.ReactElement;
};

const setup = (version: 'v2' | 'v3', formData: Record<string, unknown>) => {
  const postMutateAsync = jest.fn();
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseNavToParent.mockReturnValue('/parent');
  mockUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() });
  mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
    teamId: 1,
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
    edfiTenantId: 3,
  });
  mockUseForm.mockReturnValue({
    register: jest.fn(() => ({})),
    control: {},
    handleSubmit: (submit: (data: Record<string, unknown>) => Promise<void>) => () => submit(formData),
    setError: jest.fn(),
    formState: { errors: {}, isSubmitting: false },
  });
  postMutateAsync.mockResolvedValue({ id: 9 });
  mockUseVendorConfig.mockReturnValue({
    version,
    queries: { post: jest.fn(() => ({ mutateAsync: postMutateAsync })) },
    PostDto: class PostDtoStub {},
  });
  return { postMutateAsync };
};

describe('CreateVendorV2', () => {
  afterEach(() => jest.clearAllMocks());

  it('posts via useVendorConfig().queries for a v2 tenant', async () => {
    const { postMutateAsync } = setup('v2', { company: 'Acme' });

    const form = getFormElement();
    await form.props.onSubmit();

    expect(postMutateAsync).toHaveBeenCalledWith(
      { entity: { company: 'Acme' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('posts via useVendorConfig().queries for a v3 tenant', async () => {
    const { postMutateAsync } = setup('v3', { company: 'Acme V3' });

    const form = getFormElement();
    await form.props.onSubmit();

    expect(postMutateAsync).toHaveBeenCalledWith(
      { entity: { company: 'Acme V3' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run fe:test -- --testPathPattern "VendorV2Plus/CreateVendorPage.spec.tsx"`
Expected: FAIL — the current implementation imports `vendorQueriesV2`/`PostVendorDtoV2` directly, so `mockUseVendorConfig` (and its `postMutateAsync`) is never used, and the module-level `classValidatorResolver(PostVendorDtoV2)` call plus real `vendorQueriesV2.post` usage will not match the mocked `postMutateAsync` assertions.

- [ ] **Step 3: Update the implementation**

In `packages/fe/src/app/Pages/VendorV2Plus/CreateVendorPage.tsx`, replace:

```ts
import { Id, PostVendorDtoV2 } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { vendorQueriesV2 } from '../../api';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PostVendorDtoV2);

export const CreateVendorV2 = () => {
  const { teamId, edfiTenant, edfiTenantId } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToView = (id: string | number) =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/vendors/${id}`
    );
  const parentPath = useNavToParent();
  const postVendor = vendorQueriesV2.post({
    edfiTenant,
    teamId,
  });
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PostVendorDtoV2>({ resolver, defaultValues: {} });
```

with:

```ts
import { Id } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useVendorConfig } from './vendorConfig';

export const CreateVendorV2 = () => {
  const { teamId, edfiTenant, edfiTenantId } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();
  const { queries, PostDto } = useVendorConfig();
  const resolver = useMemo(() => classValidatorResolver(PostDto), [PostDto]);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToView = (id: string | number) =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/vendors/${id}`
    );
  const parentPath = useNavToParent();
  const postVendor = queries.post({
    edfiTenant,
    teamId,
  });
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm({ resolver, defaultValues: {} });
```

(The rest of the component body — the JSX form — is unchanged; it only used `register`, `errors`, `handleSubmit`, none of which reference the DTO type by name.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run fe:test -- --testPathPattern "VendorV2Plus/CreateVendorPage.spec.tsx"`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/fe/src/app/Pages/VendorV2Plus/CreateVendorPage.tsx packages/fe/src/app/Pages/VendorV2Plus/CreateVendorPage.spec.tsx
git commit -m "feat: make CreateVendorPage version-aware via useVendorConfig"
```

---

### Task 7: Update `EditVendor.tsx` to use `useVendorConfig`

**Files:**
- Modify: `packages/fe/src/app/Pages/VendorV2Plus/EditVendor.tsx`
- Test: `packages/fe/src/app/Pages/VendorV2Plus/EditVendor.spec.tsx`

**Interfaces:**
- Consumes: `useVendorConfig` and `VendorEntity` from `./vendorConfig` (Task 4).
- Produces: `EditVendor(props: { vendor: VendorEntity })` (name unchanged) — now edits through whichever `queries`/`PutDto` the tenant's version resolves to.

- [ ] **Step 1: Write the failing test**

Create `packages/fe/src/app/Pages/VendorV2Plus/EditVendor.spec.tsx`:

```tsx
import 'reflect-metadata';
import { EditVendor } from './EditVendor';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useVendorConfig } from './vendorConfig';

jest.mock('@edanalytics/common-ui', () => ({
  Icons: { InfoCircle: () => null },
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useParams: jest.fn(),
}));

jest.mock('react-hook-form', () => ({
  useForm: jest.fn(),
}));

jest.mock('@hookform/resolvers/class-validator', () => ({
  classValidatorResolver: jest.fn((Dto) => Dto),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('./vendorConfig', () => ({
  useVendorConfig: jest.fn(),
}));

const mockUseNavigate = useNavigate as jest.Mock;
const mockUseParams = useParams as jest.Mock;
const mockUseForm = useForm as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockUseVendorConfig = useVendorConfig as jest.Mock;

const vendor = { id: 5, company: 'Acme', namespacePrefixes: '', contactName: '', contactEmailAddress: '' };

const setup = (version: 'v2' | 'v3') => {
  const putMutateAsync = jest.fn().mockResolvedValue(vendor);
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseParams.mockReturnValue({ vendorId: '5' });
  mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
    teamId: 1,
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
  });
  mockUseForm.mockReturnValue({
    register: jest.fn(() => ({})),
    setError: jest.fn(),
    handleSubmit: (submit: (data: Record<string, unknown>) => Promise<void>) => () => submit({ company: 'Updated' }),
    formState: { errors: {}, isSubmitting: false },
  });
  mockUseVendorConfig.mockReturnValue({
    version,
    queries: { put: jest.fn(() => ({ mutateAsync: putMutateAsync })) },
    PutDto: class PutDtoStub {
      constructor() {
        Object.assign(this, {});
      }
    },
  });
  return { putMutateAsync };
};

describe('EditVendor', () => {
  afterEach(() => jest.clearAllMocks());

  it('puts via useVendorConfig().queries for a v2 tenant', async () => {
    const { putMutateAsync } = setup('v2');

    const form = EditVendor({ vendor }) as React.ReactElement;
    await form.props.onSubmit();

    expect(putMutateAsync).toHaveBeenCalledWith(
      { entity: { company: 'Updated' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('puts via useVendorConfig().queries for a v3 tenant', async () => {
    const { putMutateAsync } = setup('v3');

    const form = EditVendor({ vendor }) as React.ReactElement;
    await form.props.onSubmit();

    expect(putMutateAsync).toHaveBeenCalledWith(
      { entity: { company: 'Updated' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run fe:test -- --testPathPattern "VendorV2Plus/EditVendor.spec.tsx"`
Expected: FAIL — the current implementation imports `vendorQueriesV2`/`PutVendorDtoV2` directly rather than going through the mocked `useVendorConfig`, so `putMutateAsync` is never called as expected.

- [ ] **Step 3: Update the implementation**

In `packages/fe/src/app/Pages/VendorV2Plus/EditVendor.tsx`, replace:

```ts
import { GetVendorDtoV2, PutVendorDtoV2 } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { vendorQueriesV2 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { Icons } from '@edanalytics/common-ui';

const resolver = classValidatorResolver(PutVendorDtoV2);

export const EditVendor = (props: { vendor: GetVendorDtoV2 }) => {
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const params = useParams() as {
    vendorId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const goToView = () =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/vendors/${params.vendorId}`
    );
  const putVendor = vendorQueriesV2.put({
    edfiTenant,
    teamId,
  });

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PutVendorDtoV2>({
    resolver,
    defaultValues: Object.assign(new PutVendorDtoV2(), props.vendor),
  });
  console.log(Object.assign(new PutVendorDtoV2(), props.vendor));
```

with:

```ts
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { Icons } from '@edanalytics/common-ui';
import { VendorEntity, useVendorConfig } from './vendorConfig';

export const EditVendor = (props: { vendor: VendorEntity }) => {
  const popBanner = usePopBanner();
  const { queries, PutDto } = useVendorConfig();
  const resolver = useMemo(() => classValidatorResolver(PutDto), [PutDto]);

  const navigate = useNavigate();
  const params = useParams() as {
    vendorId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const goToView = () =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/vendors/${params.vendorId}`
    );
  const putVendor = queries.put({
    edfiTenant,
    teamId,
  });

  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver,
    defaultValues: Object.assign(new PutDto(), props.vendor),
  });
```

(Remove the leftover `console.log(...)` debug line entirely — it's dead debug output unrelated to this change, and this touch is a reasonable place to drop it since the line is being edited anyway.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run fe:test -- --testPathPattern "VendorV2Plus/EditVendor.spec.tsx"`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/fe/src/app/Pages/VendorV2Plus/EditVendor.tsx packages/fe/src/app/Pages/VendorV2Plus/EditVendor.spec.tsx
git commit -m "feat: make EditVendor version-aware via useVendorConfig"
```

---

### Task 8: Update `VendorPage.tsx`, `ViewVendor.tsx`, `VendorsPage.tsx`, `NameCell.tsx` to use `useVendorConfig`

**Files:**
- Modify: `packages/fe/src/app/Pages/VendorV2Plus/VendorPage.tsx`
- Modify: `packages/fe/src/app/Pages/VendorV2Plus/ViewVendor.tsx`
- Modify: `packages/fe/src/app/Pages/VendorV2Plus/VendorsPage.tsx`
- Modify: `packages/fe/src/app/Pages/VendorV2Plus/NameCell.tsx`
- Test: `packages/fe/src/app/Pages/VendorV2Plus/VendorsPage.spec.tsx`

**Interfaces:**
- Consumes: `useVendorConfig` and `VendorEntity` from `./vendorConfig` (Task 4); `useVendorActions` (Task 5, unchanged signature).
- Produces: `VendorPageV2`, `VendorPageContent`, `VendorPageActions`, `ViewVendor`, `VendorsPageV2`, `VendorsPageContent`, `NameCell` (all names unchanged) — all read through `useVendorConfig().queries` instead of the hardcoded `vendorQueriesV2`.

These four files are grouped into one task because they're all simple read-path call-site swaps (`vendorQueriesV2.getOne(...)` / `.getAll(...)` → `queries.getOne(...)` / `.getAll(...)`) with no DTO-class branching, unlike Tasks 6-7. One representative test (`VendorsPage`) is written; the other three follow the identical mechanical pattern and are verified by typecheck plus the full suite.

- [ ] **Step 1: Write the failing test**

Create `packages/fe/src/app/Pages/VendorV2Plus/VendorsPage.spec.tsx`:

```tsx
import 'reflect-metadata';
import { VendorsPageContent } from './VendorsPage';
import { useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useVendorConfig } from './vendorConfig';

jest.mock('@edanalytics/common-ui', () => ({
  CappedLinesText: ({ children }: { children: React.ReactNode }) => children,
  PageActions: () => null,
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
  SbaaTableAllInOne: (props: { data: unknown[] }) => JSON.stringify(props.data),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('./vendorConfig', () => ({
  useVendorConfig: jest.fn(),
}));

jest.mock('./NameCell', () => ({ NameCell: () => null }));

const mockUseQuery = useQuery as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockUseVendorConfig = useVendorConfig as jest.Mock;

const setup = (version: 'v2' | 'v3') => {
  const getAll = jest.fn(() => ({ queryKey: ['vendors'] }));
  mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
    edfiTenant: { id: 3 },
    asId: 1,
  });
  mockUseVendorConfig.mockReturnValue({ version, queries: { getAll } });
  mockUseQuery.mockReturnValue({ data: { 5: { id: 5, company: 'Acme' } } });
  return { getAll };
};

describe('VendorsPageContent', () => {
  afterEach(() => jest.clearAllMocks());

  it('calls useVendorConfig().queries.getAll for a v2 tenant', () => {
    const { getAll } = setup('v2');

    VendorsPageContent();

    expect(getAll).toHaveBeenCalledWith({ teamId: 1, edfiTenant: { id: 3 } });
  });

  it('calls useVendorConfig().queries.getAll for a v3 tenant', () => {
    const { getAll } = setup('v3');

    VendorsPageContent();

    expect(getAll).toHaveBeenCalledWith({ teamId: 1, edfiTenant: { id: 3 } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run fe:test -- --testPathPattern "VendorV2Plus/VendorsPage.spec.tsx"`
Expected: FAIL — the current implementation calls `vendorQueriesV2.getAll(...)` directly (the real, unmocked builder), not the mocked `useVendorConfig().queries.getAll`, so the `getAll` spy is never invoked.

- [ ] **Step 3: Update `VendorsPage.tsx`**

Replace:

```ts
import { vendorQueriesV2 } from '../../api';
```

with:

```ts
import { useVendorConfig } from './vendorConfig';
```

and inside `VendorsPageContent`:

```ts
export const VendorsPageContent = () => {
  const { edfiTenant, asId } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useVendorConfig();

  const vendors = useQuery(
    queries.getAll({
      teamId: asId,
      edfiTenant,
    })
  );
```

- [ ] **Step 4: Update `VendorPage.tsx`**

Replace:

```ts
import { vendorQueriesV2 } from '../../api';
```

with:

```ts
import { useVendorConfig } from './vendorConfig';
```

and in each of `VendorPageContent`, `VendorPageTitle`, `VendorPageActions`, add `const { queries } = useVendorConfig();` alongside the existing `useTeamEdfiTenantNavContextLoaded()` call, then change every `vendorQueriesV2.getOne(...)` call in this file to `queries.getOne(...)`.

- [ ] **Step 5: Update `ViewVendor.tsx`**

Replace:

```ts
import { vendorQueriesV2 } from '../../api';
```

with:

```ts
import { useVendorConfig } from './vendorConfig';
```

and inside `ViewVendor`:

```ts
export const ViewVendor = () => {
  const params = useParams() as {
    vendorId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useVendorConfig();
  const vendor = useQuery(
    queries.getOne({
      teamId,
      id: params.vendorId,
      edfiTenant,
    })
  ).data;
```

- [ ] **Step 6: Update `NameCell.tsx`**

Replace:

```ts
import { GetVendorDtoV2 } from '@edanalytics/models';
import { vendorQueriesV2 } from '../../api';
```

with:

```ts
import { VendorEntity, useVendorConfig } from './vendorConfig';
```

and change the component signature and body:

```ts
export const NameCell = (info: CellContext<VendorEntity, unknown>) => {
  const { edfiTenant, teamId, edfiTenantId, asId } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useVendorConfig();
  const vendors = useQuery(
    queries.getAll({
      teamId,
      edfiTenant,
    })
  );
```

(`VendorLinkV2` from `'../../routes'` is unchanged — it only reads `id`/`displayName` off whatever query result it's given, both of which exist identically on `GetVendorDtoV2` and `GetVendorDtoV3`.)

- [ ] **Step 7: Run test to verify it passes**

Run: `npx nx run fe:test -- --testPathPattern "VendorV2Plus/VendorsPage.spec.tsx"`
Expected: PASS (2 tests)

- [ ] **Step 8: Typecheck the whole package**

Run: `npx nx run fe:build`
Expected: no errors (confirms `VendorPage.tsx`, `ViewVendor.tsx`, and `NameCell.tsx` compile correctly even without their own dedicated spec files).

- [ ] **Step 9: Commit**

```bash
git add packages/fe/src/app/Pages/VendorV2Plus/VendorPage.tsx packages/fe/src/app/Pages/VendorV2Plus/ViewVendor.tsx packages/fe/src/app/Pages/VendorV2Plus/VendorsPage.tsx packages/fe/src/app/Pages/VendorV2Plus/NameCell.tsx packages/fe/src/app/Pages/VendorV2Plus/VendorsPage.spec.tsx
git commit -m "feat: make VendorPage, ViewVendor, VendorsPage, NameCell version-aware"
```

---

### Task 9: Wire V3 into `vendor.routes.tsx`

**Files:**
- Modify: `packages/fe/src/app/routes/vendor.routes.tsx`

**Interfaces:**
- Consumes: `VersioningHoc` from `packages/fe/src/app/helpers` (existing, already accepts a `v3` prop — see `packages/fe/src/app/helpers/VersioningHoc.tsx`); `vendorQueriesV3` from `packages/fe/src/app/api` (Task 1); `VendorPageV2`, `VendorsPageV2`, `CreateVendorV2` (Task 3's renamed imports).
- Produces: the same 5 exported route objects/components (`vendorCreateRoute`, `vendorIndexRoute`, `vendorRoute`, `vendorsIndexRoute`, `vendorsRoute`, `VendorLinkV1`, `VendorLinkV2`) — now each `VersioningHoc` usage also renders for `v3` tenants.

No new component logic here — this is route-table wiring, matching the existing V1/V2 pattern. No dedicated spec file exists for this route file today, so verification is via typecheck, the full suite, and Task 10's manual/E2E check.

- [ ] **Step 1: Add a `VendorBreadcrumbV3` alongside the existing V2 one**

In `packages/fe/src/app/routes/vendor.routes.tsx`, add (right after `VendorBreadcrumbV2`):

```tsx
const VendorBreadcrumbV3 = () => {
  const params = useParams() as {
    vendorId: string;
  };
  const { edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();
  const vendor = useQuery(
    vendorQueriesV3.getOne({
      id: params.vendorId,
      teamId,
      edfiTenant,
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (vendor.data?.displayName ?? params.vendorId) as any;
};
```

And add `vendorQueriesV3` to the existing import from `'../api'`:

```ts
import { vendorQueriesV1, vendorQueriesV2, vendorQueriesV3 } from '../api';
```

- [ ] **Step 2: Add `v3` to each `VersioningHoc` usage**

Update the four route definitions:

```tsx
export const vendorCreateRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/vendors/create',
  element: <VersioningHoc v1={<CreateVendor />} v2={<CreateVendorV2 />} v3={<CreateVendorV2 />} />,
  handle: { crumb: () => 'Create Vendor' },
};
export const vendorIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/vendors/:vendorId/',
  element: <VersioningHoc v1={<VendorPage />} v2={<VendorPageV2 />} v3={<VendorPageV2 />} />,
};

export const vendorRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/vendors/:vendorId',
  handle: {
    crumb: withLoader(() => (
      <VersioningHoc
        v1={<VendorBreadcrumbV1 />}
        v2={<VendorBreadcrumbV2 />}
        v3={<VendorBreadcrumbV3 />}
      />
    )),
  },
};
export const vendorsIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/vendors/',
  element: <VersioningHoc v1={<VendorsPage />} v2={<VendorsPageV2 />} v3={<VendorsPageV2 />} />,
};
```

(`vendorsRoute`, `VendorLinkV1`, and `VendorLinkV2` are unchanged — `VendorLinkV2` is reused as-is for V3 tenants since it only needs `id`/`displayName`, both present identically on the V3 DTO.)

- [ ] **Step 3: Typecheck and run the full frontend test suite**

Run: `npx nx run fe:build && npx nx run fe:test`
Expected: no errors; all tests pass (including Tasks 2, 5, 6, 7, 8's new specs).

- [ ] **Step 4: Commit**

```bash
git add packages/fe/src/app/routes/vendor.routes.tsx
git commit -m "feat: route V3 tenants to the version-aware Vendor pages"
```

---

### Task 10: Regression check and manual V3 CRUD verification

**Files:** none (verification-only task).

**Interfaces:** none — this task consumes the fully wired feature from Tasks 1-9 and produces a verification record (checked boxes / notes), not code.

- [ ] **Step 1: Run the full frontend test suite**

Run: `npx nx run fe:test`
Expected: all tests pass, including every pre-existing spec (confirms no V1/V2 regression) and all specs added in Tasks 2, 5, 6, 7, 8.

- [ ] **Step 2: Run the full frontend typecheck and lint**

Run: `npx nx run fe:build && npx nx run fe:lint`
Expected: no errors.

- [ ] **Step 3: Start the app against a V3-specification tenant**

Run: `npm run start:fe:dev` (and `npm run start:api:dev` in a second terminal if not already running), then navigate to a tenant whose `sbEnvironment.version` is `'v3'` (create one via the existing SbEnvironment admin UI if none exists in your local environment, selecting the V3 specification).

- [ ] **Step 4: Manually verify each V3 Vendor CRUD flow**

- Navigate to the tenant's Vendors list — confirm it loads (empty or populated) with no console errors.
- Click "New" — create a vendor with a company name, namespace prefix, contact name, and contact email. Confirm it saves and redirects to the vendor's detail view.
- Confirm the detail view shows the fields you entered.
- Click "Edit" — change the company name, save, and confirm the updated value shows in the detail view.
- Click "Delete" and confirm — confirm the vendor disappears from the list and you're redirected to the Vendors list.

- [ ] **Step 5: Manually spot-check V1 and V2 tenants are unchanged**

Navigate to an existing V1 tenant's Vendors page and an existing V2 tenant's Vendors page. Confirm list/create/view/edit/delete all behave exactly as before this change (per the ticket's explicit "no V1/V2 behavior change" scope boundary).

- [ ] **Step 6: Record verification results**

No commit for this task (verification-only) — note the outcome (pass/fail + any issues found) back to the requester/reviewer before closing out AC-527.

---

## Self-Review Notes

- **Spec coverage:** All 5 success criteria from 527.md (see list, create, view, edit, delete for V3) are covered — list/view/getOne/getAll in Task 8, create in Task 6, edit in Task 7, delete in Task 5, routing for all of them in Task 9, and end-to-end confirmation in Task 10. The reusable-factory requirement (from the brainstorming discussion) is covered by Task 2. The "V1 explicitly excluded" requirement is covered by the `VersionedResourceKey` type in Task 2 and the naming/scope note in Task 3.
- **Placeholder scan:** No TBD/TODO markers; every step shows the actual code to write, not a description of it.
- **Type consistency:** `VendorEntity`, `useVendorConfig`, `VendorConfig` (`{ version, queries, PostDto, PutDto }`) are defined once in Task 4 and referenced with the same names/shapes in Tasks 5-8. `createVersionedResource`'s signature (Task 2) matches its usage in Task 4 exactly.
