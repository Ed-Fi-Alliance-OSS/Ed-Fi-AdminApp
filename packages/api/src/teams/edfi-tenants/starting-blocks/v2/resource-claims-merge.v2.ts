import { GetResourceClaimDetailDtoV2, GetResourceClaimDtoV2 } from '@edanalytics/models';

// AC-439: Admin Api v2's `GET claimSets/{id}` silently excludes any
// resourceClaims item (at any depth) that has no actions associated — so
// types/descriptors like `schoolYearType` never appear on the claimset
// display. `GET resourceClaims` (see AdminApiServiceV2.getResourceClaims)
// returns the complete hierarchy regardless of actions, so we use it as the
// source of truth for which nodes exist, and fill in any node missing from
// the claimset's own (possibly pruned) `resourceClaims` tree with a
// synthesized entry that has no actions/authorization strategies at all —
// which the existing ResourceClaimsTableV2 already renders as "Denied" for
// every action column.
const buildDeniedNode = (detail: GetResourceClaimDetailDtoV2): GetResourceClaimDtoV2 =>
  ({
    id: detail.id,
    name: detail.name,
    actions: [],
    authorizationStrategyOverridesForCRUD: [],
    _defaultAuthorizationStrategiesForCRUD: [],
    children: detail.children.map(buildDeniedNode),
  }) as unknown as GetResourceClaimDtoV2;

export const mergeResourceClaimsV2 = (
  existing: GetResourceClaimDtoV2[],
  detail: GetResourceClaimDetailDtoV2[]
): GetResourceClaimDtoV2[] => {
  const existingById = new Map(existing.map((rc) => [String(rc.id), rc]));

  return detail.map((detailNode) => {
    const existingNode = existingById.get(String(detailNode.id));
    if (!existingNode) {
      return buildDeniedNode(detailNode);
    }
    return {
      ...existingNode,
      children: mergeResourceClaimsV2(existingNode.children, detailNode.children),
    };
  });
};
