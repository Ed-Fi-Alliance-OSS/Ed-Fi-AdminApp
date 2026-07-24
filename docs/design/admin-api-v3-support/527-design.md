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
export type VersionedResourceKey = 'v2' | 'v3';

// Distributive mapped type: because this is indexed by `K` and collected via
// `[VersionedResourceKey]`, TS distributes it into a genuine discriminated
// union (`{version:'v2'} & ByVersionV2 | {version:'v3'} & ByVersionV3`)
// derived from whatever shape each branch of `byVersion` has — callers never
// hand-write the union themselves, so there's no way to accidentally
// instantiate the broken merged/non-discriminated shape (see caveat below).
type VersionedConfig<ByVersion extends Partial<Record<VersionedResourceKey, object>>> = {
  [K in VersionedResourceKey]: K extends keyof ByVersion ? { version: K } & ByVersion[K] : never;
}[VersionedResourceKey];

export function createVersionedResource<
  ByVersion extends Partial<Record<VersionedResourceKey, object>>
>(byVersion: ByVersion) {
  return function useVersionedResource(): VersionedConfig<ByVersion> {
    const { edfiTenant } = useTeamEdfiTenantNavContextLoaded();
    const version = edfiTenant.sbEnvironment.version as VersionedResourceKey;
    const resource = version && byVersion[version];
    if (!resource) {
      throw new Error(`No resource registered for admin API version "${version}"`);
    }
    return { version, ...resource } as VersionedConfig<ByVersion>;
  };
}
```

V1 is deliberately excluded from `VersionedResourceKey` — this factory is
for the "V2Plus" pattern only. AC-528/529/530 (Application, Claimset,
Profile, ApiClient) can reuse this factory verbatim with their own
per-entity config shape — each entity's config file only supplies the
per-version data (`queries`, DTO classes, etc.), not a hand-written
`version` field or union type:

```ts
export const useVendorConfig = createVersionedResource({
  v2: { queries: vendorQueriesV2, PostDto: PostVendorDtoV2, PutDto: PutVendorDtoV2 },
  v3: { queries: vendorQueriesV3, PostDto: PostVendorDtoV3, PutDto: PutVendorDtoV3 },
});
// useVendorConfig(): { version: 'v2'; queries: typeof vendorQueriesV2; ... }
//                  | { version: 'v3'; queries: typeof vendorQueriesV3; ... }
```

**Why the union must stay discriminated at the type level, not just at the
declaration site:** if a caller instead wrote `Config` as one flattened,
non-discriminated type (or the factory's generic collapsed the branches into
a single shape), `useVendorConfig().queries` would become a union of two
distinct function types (`vendorQueriesV2['getOne'] | vendorQueriesV3['getOne']`).
Calling it still type-checks, but the result —
`UseQueryOptions<GetVendorDtoV2> | UseQueryOptions<GetVendorDtoV3>` — is a
union of two different generic instantiations, and passing that into
`useQuery()` fails: TypeScript can't pick a single overload of a generic,
overloaded function from a union argument. `vendor`'s inferred type
(`GetVendorDtoV2 | GetVendorDtoV3 | undefined`) and the `useQuery` call
itself both become unresolvable. Keeping the union distributive (as above)
avoids this — react-query's generic overload widens `TQueryFnData` to
`GetVendorDtoV2 | GetVendorDtoV3` in one call instead of being handed two
incompatible calls to choose between.

**Remaining caveat:** this correlation only holds at the point
`useVendorConfig()` is called — destructuring
`const { queries, PostDto } = useVendorConfig()` in a consumer doesn't stop
TypeScript from later pairing `queries` from one branch with a DTO from the
other. That's safe today only because `GetVendorDtoV2`/`GetVendorDtoV3` (and
their Post/Put counterparts) are structurally identical; a future V3 entity
whose DTOs actually diverge in shape would need each consumer to keep the
whole config object together (or branch on `version` before destructuring)
rather than pulling `queries` and DTOs apart.

### 2. API layer: add `vendorQueriesV3` and a per-version config

In `queries.v7.ts`, add `vendorQueriesV3` mirroring `vendorQueriesV2`, built
with `GetVendorDtoV3` / `PostVendorDtoV3` / `PutVendorDtoV3`.

New file `Pages/VendorV2Plus/vendorConfig.ts`:

```ts
export const useVendorConfig = createVersionedResource({
  v2: { queries: vendorQueriesV2, PostDto: PostVendorDtoV2, PutDto: PutVendorDtoV2 },
  v3: { queries: vendorQueriesV3, PostDto: PostVendorDtoV3, PutDto: PutVendorDtoV3 },
});
```

`version` doesn't need to be written per-branch — `createVersionedResource`
injects it, and derives the return type as a discriminated union (see
point 1 for why that distinction matters). Bundling `queries` + DTO classes
+ `version` into one config object means components never write a
`version === 'v3' ? X : Y` conditional for the common case — they just call
`useVendorConfig()` and destructure what they need. `version` is exposed on
the config so a future field-level divergence (see below) can still branch
narrowly without changing this factory's shape.

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

(See point 1 for why `useVendorConfig()`'s return type must stay a
discriminated union rather than a merged shape, and for the
destructure-correlation caveat that still applies when a component pulls
`queries`/`PostDto`/`PutDto` apart.)

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
