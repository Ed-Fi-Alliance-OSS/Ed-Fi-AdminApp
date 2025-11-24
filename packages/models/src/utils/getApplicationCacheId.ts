export const edorgCompositeKey = (args: {
  /** instanceId for v2, dbName for v1 */
  ods: number | string;
  /** educationOrganizationId */
  edorg: number | string;
}) =>
  `${
    // TODO the "correct" business logic is that ods is baked into edorg, so including it explicitly is unnecessary. The problem is that Admin API doesn't guarantee referential integrity, and we've waffled on what to do about it. This will be nailed down in the v7 work.
    ''
  }${args.edorg}`;

export function edorgKeyV2(args: {
  /** odsInstanceId &mdash; only present in v7/v2 environments. */
  ods: number | string | null;
  /** educationOrganizationId &mdash; sufficient alone pre-v7/v2. */
  edorg: number | string;
}) {
  return `${args.ods}-${args.edorg}`;
}
