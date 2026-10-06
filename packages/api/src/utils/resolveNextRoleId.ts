/**
 * The roleId an update will persist: the body's value when it has its own `roleId` (including
 * an explicit `null`, which unassigns), otherwise the current one. Uses the same own-property
 * rule as `applyDtoUpdates`, so the role that gets checked is the role that gets saved.
 */
export const resolveNextRoleId = (
  dto: object & { roleId?: number | null },
  currentRoleId: number | null | undefined
): number | null | undefined =>
  Object.prototype.hasOwnProperty.call(dto, 'roleId') ? dto.roleId : currentRoleId;
