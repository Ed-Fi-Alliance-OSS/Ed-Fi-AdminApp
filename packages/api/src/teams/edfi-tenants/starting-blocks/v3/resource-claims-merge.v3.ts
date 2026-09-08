import { GetResourceClaimDetailDtoV3, GetResourceClaimDtoV3 } from '@edanalytics/models';

// AC-439: Admin Api v3's `GET claimSets/{id}` silently excludes any
// resourceClaims item (at any depth) that has no actions associated — so
// types/descriptors like `schoolYearType` never appear on the claimset
// display. `GET resourceClaims` returns the complete hierarchy regardless of
// actions, so we use it as the source of truth for which nodes exist.
//
// Unlike V2, V3's claimset resourceClaims is a *flat* list joined by
// claimName/parentClaimName (a real claim URI) rather than nested `children`,
// and the resourceClaims-detail endpoint has no `claimName` at all — only a
// plain `name`/`parentName`/`id`. So matching existing <-> detail nodes has
// to go by plain `name`, and any node missing from the existing list needs a
// synthesized claimName manufactured for it (and used as its own children's
// parentClaimName), built from its ancestor path so it can never collide
// with a real claim URI or with a same-named node in another branch.
const SYNTHETIC_CLAIM_NAME_PREFIX = 'synthetic-resource-claim:';

const buildDeniedEntry = (
  detail: GetResourceClaimDetailDtoV3,
  parentClaimName: string | null
): GetResourceClaimDtoV3 =>
  ({
    name: detail.name,
    claimName: `${SYNTHETIC_CLAIM_NAME_PREFIX}${parentClaimName ?? 'root'}/${detail.name}`,
    parentClaimName,
    actions: [],
    _defaultAuthorizationStrategies: [],
    authorizationStrategyOverrides: [],
  }) as unknown as GetResourceClaimDtoV3;

export const mergeResourceClaimsV3 = (
  existing: GetResourceClaimDtoV3[],
  detail: GetResourceClaimDetailDtoV3[]
): GetResourceClaimDtoV3[] => {
  const existingByName = new Map(existing.map((rc) => [rc.name, rc]));
  const added: GetResourceClaimDtoV3[] = [];

  const walk = (nodes: GetResourceClaimDetailDtoV3[], parentClaimName: string | null) => {
    nodes.forEach((node) => {
      const existingEntry = existingByName.get(node.name);
      const resolvedClaimName = existingEntry?.claimName;
      let claimNameForChildren = resolvedClaimName;

      if (!existingEntry) {
        const denied = buildDeniedEntry(node, parentClaimName);
        added.push(denied);
        claimNameForChildren = denied.claimName;
      }

      walk(node.children, claimNameForChildren ?? null);
    });
  };

  walk(detail, null);

  return [...existing, ...added];
};
