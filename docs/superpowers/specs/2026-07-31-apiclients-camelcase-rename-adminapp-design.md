# Adapt AdminApp to Admin API's `apiClients` Rename (V2 only)

**Jira:** [AC-578](https://edfi.atlassian.net/browse/AC-578) (blocked by [ADMINAPI-1476](https://edfi.atlassian.net/browse/ADMINAPI-1476))

## Problem

The Admin API backend renamed its V2 `apiclients` HTTP routes to camelCase `apiClients` (ADMINAPI-1476, now in review). AdminApp's frontend builds its Admin API request paths using a lowercase `'apiclient'` literal, so once the backend change ships, AdminApp's V2 ApiClients CRUD calls would hit a path in the wrong casing. Separately, AdminApp's own client-side (React Router) URLs for the ApiClients pages also use the lowercase spelling.

## Approach

Direct literal-string edits, matching the existing code pattern exactly — every other entity in `queries.v7.ts` (e.g. `applicationQueriesV2`, `claimsetQueriesV2`) hardcodes its own `kebabCaseName` inline rather than sharing a constant, so a one-off shared constant here would be inconsistent with the codebase's convention and isn't needed for a one-time rename.

Two independent groups of changes:

### Group 1 — backend-facing HTTP calls

`packages/fe/src/app/api/queries/queries.v7.ts` funnels every V2 ApiClients HTTP call (GET list, GET one, PUT, PUT reset-credential, POST, DELETE) through `standardPath({ kebabCaseName: 'apiclient', ... })`, which appends `s` to build the real URL segment (`.../admin-api/v2/apiclients`). This is the single choke point — changing the 6 occurrences of `kebabCaseName: 'apiclient'` to `'apiClient'` (lines 81, 92, 104, 119, 131, 146) is sufficient; no other backend-call code needs touching.

### Group 2 — AdminApp's own UI routes

AdminApp's client-side React Router paths for the ApiClients pages also spell the segment lowercase. Renaming them for casing consistency:
- `packages/fe/src/app/routes/apiclients.routes.tsx` renamed to `apiClients.routes.tsx`; its 5 route path strings and 1 `Link to=` template updated to `apiClients`.
- `packages/fe/src/app/routes/index.tsx` — update the import path (line 26) to `'./apiClients.routes'`.
- Inline route-template literals updated in: `packages/fe/src/app/Pages/ApiClientV2/CreateApiClientPage.tsx:46`, `EditApiClient.tsx:36`, `useApiClientActions.tsx:54,55,148,170`, `packages/fe/src/app/Pages/ApplicationV2/useApplicationActions.tsx:114,117`.

**Note on backward compatibility:** React Router (used here) matches paths case-insensitively by default (no `caseSensitive` prop is set anywhere in this codebase), so this rename does not break any existing bookmarks or deep links — old lowercase URLs continue to resolve to the same routes. This mirrors the backend finding in ADMINAPI-1476 (ASP.NET Core routing is also case-insensitive by default).

## Explicitly out of scope

- **V3** — the Admin API's V3 `apiclients` routes have not been renamed yet, and no `apiClientQueriesV3` builder or V3 ApiClients pages exist in the FE, so there is nothing to touch at the V3 level.
- **Other entities** (`applicationQueriesV2`, `claimsetQueriesV2`, `vendorQueriesV2`, etc.) — unaffected by this rename.
- **`docs/design/Multiple-credentials-per-application.md`** — contains example curl calls using the old casing; can be updated separately (same precedent as the backend PR, which left its own build-generated docs for a separate pass).
- **Generated API clients** — none exist for this path; `packages/models` DTOs are hand-written TypeScript type names, not URL-generating code, and were not found to contain any URL literal needing a change.

## Testing

No existing FE unit or e2e test references the `apiclient` literal (confirmed via search), so there is nothing pre-existing to update to satisfy the Jira AC's "tests are updated" line — the plan is:
- Run the existing FE test suite to confirm no regression.
- Manually exercise the V2 ApiClients CRUD flow (list, create, view, edit, reset credentials, delete) against a running Admin API to satisfy the Jira AC ("CRUD operations are all working fine").

## Risks

- **None for existing AdminApp users** — React Router's case-insensitive matching means old bookmarked URLs keep working; the backend rename change is the only source of a real behavior dependency, and it is a strict superset of what AdminApp already sends once `kebabCaseName` is updated to match.
