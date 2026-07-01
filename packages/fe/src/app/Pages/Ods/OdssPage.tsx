import { Badge, HStack, Link } from '@chakra-ui/react';
import { Icons, PageActions, PageTemplate, SbaaTableAllInOne, TableRowActions } from '@edanalytics/common-ui';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { OdsSampleRow, odsStatusDisplayMap, sampleOdsData } from './odsData';
import { useOdssActions } from './useOdssActions';

const useOdsRowActions = (ods: OdsSampleRow) => {
  const { teamId, edfiTenant, edfiTenantId, sbEnvironmentId } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();
  const to = `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/odss/${ods.id}/`;
  return {
    View: {
      icon: Icons.View,
      text: 'View',
      title: 'View ' + ods.name,
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

const NameCell = (info: CellContext<OdsSampleRow, unknown>) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { id, name } = info.row.original;
  const to = `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/odss/${id}/`;
  const actions = useOdsRowActions(info.row.original);
  return (
    <HStack justify="space-between">
      <Link as="span">
        <RouterLink title="Go to ODS" to={to}>
          {name}
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
  return (
    <SbaaTableAllInOne
      data={sampleOdsData}
      columns={[
        { accessorKey: 'name', cell: NameCell, header: 'Name' },
        { accessorKey: 'type', header: 'Type' },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: (info) => {
            const { label, colorScheme } = odsStatusDisplayMap[info.row.original.status];
            return <Badge colorScheme={colorScheme}>{label}</Badge>;
          },
        },
      ]}
    />
  );
};
