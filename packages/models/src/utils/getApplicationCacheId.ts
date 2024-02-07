export const createEdorgCompositeNaturalKey = (args: {
  odsDbName: number | string;
  educationOrganizationId: number | string;
}) =>
  `${
    // TODO the "correct" business logic is that ods is baked into edorg, so including it explicitly is unnecessary. The problem is that Admin API doesn't guarantee referential integrity, and we've waffled on what to do about it. This will be nailed down in the v7 work.
    ''
  }-${args.educationOrganizationId}`;
