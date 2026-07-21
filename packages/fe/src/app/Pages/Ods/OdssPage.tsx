import { Icons, PageActions, PageTemplate, SbaaTableAllInOne, TableRowActions } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { odsQueries } from '../../api/queries/queries';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { CellContext } from '@tanstack/react-table';
import { useOdssActions } from './useOdssActions';
import { Badge, HStack, Link } from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { GetOdsDto } from '@edanalytics/models';
import { odsStatusDisplayMap } from './Utils';

const useOdsRowActions = (ods: GetOdsDto) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();
  const to = `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/odss/${ods.id}/`;
  return {
    View: {
      icon: Icons.View,
      text: 'View',
      title: 'View ' + ods.displayName,
      to,
      onClick: () => navigate(to),
    },
    Delete: {
      icon: Icons.Delete,
      text: 'Delete',
      title: 'Delete ODS',
      confirmBody: 'This will permanently delete the ODS.',
      confirm: true,
      onClick: () => {},
    },
  };
};

const NameCell = (info: CellContext<GetOdsDto, unknown>) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { id, displayName } = info.row.original;
  const to = `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/odss/${id}/`;
  const actions = useOdsRowActions(info.row.original);
  return (
    <HStack justify="space-between">
      <Link as="span">
        <RouterLink title="Go to ODS" to={to}>
          {displayName}
        </RouterLink>
      </Link>
      <TableRowActions actions={actions} />
    </HStack>
  );
};

export const OdssPage = () => {
  const actions = useOdssActions();
  return (
    <PageTemplate actions={<PageActions actions={actions} />} title="Operational Data Stores">
      <OdssTable />
    </PageTemplate>
  );
};

export const OdssTable = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const odss = useQuery({
    ...odsQueries.getAll({
      edfiTenant,
      teamId,
    }),
    staleTime: 0,
    gcTime: 0,
  });

  return (
    <SbaaTableAllInOne
      data={Object.values(odss?.data || {})}
      columns={[
        { accessorKey: 'displayName', cell: NameCell, header: 'Name' },
        { accessorKey: 'instanceType', header: 'Type' },
        { accessorKey: 'status', header: 'Status', cell: (info) => {
            const { label, colorScheme } = (odsStatusDisplayMap[info.row.original.status ?? 'null'] ?? odsStatusDisplayMap['null']);
            return <Badge colorScheme={colorScheme}>{label}</Badge>;
          },
        },
      ]}
    />
  );
};
