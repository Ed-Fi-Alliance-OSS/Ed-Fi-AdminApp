import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetOdsDto } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { CellContext } from '@tanstack/react-table';
import { odsQueries } from '../../api/queries/queries';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useReadTeamEntity } from '../../helpers/useStandardRowActionsNew';
import { OdsLink, odsRoute } from '../../routes';

export const NameCell = (info: CellContext<GetOdsDto, unknown>) => {
  const { teamId, edfiTenant, asId, edfiTenantId, sbEnvironmentId } =
    useTeamEdfiTenantNavContextLoaded();
  const entities = useQuery(
    odsQueries.getAll({
      edfiTenant,
      teamId,
    })
  );
  const View = useReadTeamEntity({
    entity: info.row.original,
    params: { asId, edfiTenantId, sbEnvironmentId, odsId: info.row.original.id },
    privilege: 'team.sb-environment.edfi-tenant.ods:read',
    route: odsRoute,
  });
  const actions = {
    ...(View ? { View } : undefined),
  };
  return (
    <HStack justify="space-between">
      <OdsLink id={info.row.original.id} query={entities} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
