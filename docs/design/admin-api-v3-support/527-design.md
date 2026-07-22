# AC-527 Vendor Management V3 Frontend — Design

## Context

The backend V3 vendor CRUD (AC-524/AC-526) is complete and stable. This is
frontend-only work: give V3-specification tenants the same Vendor list,
create, view, edit, and delete experience that V2 tenants already have, with
no changes to V1 or V2 Vendor behavior.

## Key findings that shape this design

- `GetVendorDtoV3` / `PostVendorDtoV3` / `PutVendorDtoV3` (in
  `packages/models/src/dtos/edfi-admin-api.v3.dto.ts`) are structurally
  identical to their V2 counterparts — both extend the same V1 base
  (`PostVendorDto`) without adding fields.
- The query builder (`packages/fe/src/app/api/queries/builder.ts`) already
  resolves the admin-api URL segment dynamically from
  `edfiTenant.sbEnvironment.version`, so a V3 query builder needs no special
  path handling.
- `SbaaAdminApiVersion` already includes `'v3'`, and `VersioningHoc` already
  accepts a `v3` prop — the route-level plumbing for V3 already exists, it's
  just unused for Vendor today.
- Every Vendor component already reads `edfiTenant` (and therefore
  `edfiTenant.sbEnvironment.version`) via `useTeamEdfiTenantNavContextLoaded()`.
- V1's DTO fields are also structurally compatible, but V1 is explicitly out
  of scope for this ticket (different tenant-resolution semantics, legacy
  credential flow, and the ticket's own scope boundary forbids touching V1
  behavior). This design intentionally does not fold V1 in.

## Approach: version-aware `VendorV2Plus` surface (not a duplicated `VendorV3` folder)

Duplicating `Pages/VendorV2` into `Pages/VendorV3` would produce two folders
with byte-for-byte identical forms, table columns, and actions, diverging
only in which query-builder/DTO classes they call. Instead, extend the
existing V2 surface to resolve its query set and DTO classes per-tenant at
runtime, and rename the folder `VendorV2Plus` to make the "V2 and later, not
V1" scope explicit and intentional rather than an accidental omission.

### 1. Shared versioned-resource factory (new, reusable across AC-528/529/530)

New file `packages/fe/src/app/api/queries/versioned.ts`:

```ts
export function createVersionedResource<Config>(
  byVersion: Partial<Record<'v2' | 'v3', Config>>
) {
  return function useVersionedResource(): Config {
    const { edfiTenant } = useTeamEdfiTenantNavContextLoaded();
    const version = edfiTenant.sbEnvironment.version;
    const resource = version && byVersion[version];
    if (!resource) {
      throw new Error(`No resource registered for admin API version "${version}"`);
    }
    return resource;
  };
}
```

V1 is deliberately excluded from the type signature — this factory is for
the "V2Plus" pattern only. AC-528/529/530 (Application, Claimset, Profile,
ApiClient) can reuse this factory verbatim with their own per-entity config
shape.

### 2. API layer: add `vendorQueriesV3` and a per-version config

In `queries.v7.ts`, add `vendorQueriesV3` mirroring `vendorQueriesV2`, built
with `GetVendorDtoV3` / `PostVendorDtoV3` / `PutVendorDtoV3`.

New file `Pages/VendorV2Plus/vendorConfig.ts`:

```ts
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

Bundling `queries` + DTO classes + the raw `version` into one config object
means components never write a `version === 'v3' ? X : Y` conditional for
the common case — they just call `useVendorConfig()` and destructure what
they need. `version` is exposed on the config so a future field-level
divergence (see below) can still branch narrowly without changing this
factory's shape.

### 3. Component changes: `Pages/VendorV2` → `Pages/VendorV2Plus`

Each component (`VendorsPage`, `VendorPage`, `ViewVendor`, `EditVendor`,
`CreateVendorPage`, `NameCell`, `useVendorActions`) swaps its direct
`vendorQueriesV2` import for `useVendorConfig().queries`. The two spots that
need a specific DTO class use the config's `PostDto`/`PutDto` instead of a
hardcoded one:

- `CreateVendorPage`: `classValidatorResolver(useVendorConfig().PostDto)`
- `EditVendor`: `classValidatorResolver(useVendorConfig().PutDto)`

Everywhere else (table columns, view fields, actions) is untouched — it
runs against whichever DTO the config resolves to, since today's fields are
identical across V2/V3.

**If V3 later introduces a field V2 doesn't have:** this is a normal,
localized change, not a redesign. The new field goes on `GetVendorDtoV3`/
`PostVendorDtoV3` only (backend, unaffected by this design). On the
frontend, the relevant component adds one narrow conditional around the new
field, e.g. `{useVendorConfig().version === 'v3' && <FormControl>...</FormControl>}`,
rather than a parallel component tree.

### 4. Routing (`vendor.routes.tsx`)

Add `v3` branches pointing at the same (now version-aware) components, no
new route paths:

```tsx
<VersioningHoc v1={<VendorPage />} v2={<VendorPageV2 />} v3={<VendorPageV2 />} />
```

Applied to the vendors-index, vendor-detail, create, and breadcrumb routes.

### 5. Error handling

An unmapped/unsupported version throws inside `useVersionedResource()`,
caught by the existing page-level `ErrorBoundary` pattern already used for
`VendorPageTitle`, rather than silently falling back to V2 behavior for a
V3 tenant.

### 6. Testing

- Unit test `createVersionedResource` (v2 selection, v3 selection, throws on
  an unmapped version).
- Exercise existing VendorV2Plus test patterns (if any) against V3
  fixtures/DTOs to confirm identical CRUD behavior.
- Manual/E2E regression check: V1 and V2 tenant Vendor pages remain
  behavior-identical to before this change, per the ticket's explicit scope
  boundary.

## Explicit scope boundaries (carried from 527.md)

**In scope:** Vendor list, create, view, edit, delete for V3-specification
tenants, matching existing V2 UX/fields exactly.

**Out of scope:** Any change to V1 Vendor pages/behavior; any change to V2
Vendor behavior (internal refactor only); any other V3 entity (Application,
Claimset, Profile, ApiClient — AC-528/529/530).
