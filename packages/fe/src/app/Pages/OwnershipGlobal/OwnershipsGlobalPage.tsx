import { Box, HStack } from '@chakra-ui/react';
import {
  ActionBarActions,
  SbaaTableAllInOne,
  PageTemplate,
  SbaaTable,
  SbaaTableAdvancedButton,
  SbaaTableFilters,
  SbaaTablePagination,
  SbaaTableProvider,
  SbaaTableSearch,
  TableRowActions,
  ValueAsDate,
} from '@edanalytics/common-ui';
import { GetOwnershipDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { ownershipQueries, roleQueries, tenantQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { OwnershipGlobalLink, TenantLink } from '../../routes';
import { RoleGlobalLink } from '../../routes/role-global.routes';
import { useMultipleOwnershipGlobalActions } from './useMultipleOwnershipGlobalActions';
import { useOwnershipGlobalActions } from './useOwnershipGlobalActions';

const OwnershipsNameCell = (info: CellContext<GetOwnershipDto, unknown>) => {
  const ownerships = ownershipQueries.useAll({});
  const actions = useOwnershipGlobalActions(info.row.original);
  return (
    <HStack justify="space-between">
      <OwnershipGlobalLink id={info.row.original.id} query={ownerships} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};

export const OwnershipsGlobalPage = () => {
  const ownerships = ownershipQueries.useAll({});
  const roles = roleQueries.useAll({});
  const tenants = tenantQueries.useAll({});
  const actions = useMultipleOwnershipGlobalActions();
  return (
    <PageTemplate title="Resource ownerships" actions={<ActionBarActions actions={actions} />}>
      <SbaaTableAllInOne
        data={Object.values(ownerships?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: OwnershipsNameCell,
            header: 'Name',
          },
          {
            id: 'tenant',
            accessorFn: (info) => getRelationDisplayName(info.tenantId, tenants),
            header: 'Tenant',
            cell: (info) => <TenantLink id={info.row.original.tenantId} query={tenants} />,
            meta: {
              type: 'options',
            },
          },
          {
            id: 'role',
            accessorFn: (info) => getRelationDisplayName(info.roleId, roles),
            header: 'Role',
            cell: (info) => <RoleGlobalLink id={info.row.original.roleId} query={roles} />,
            meta: {
              type: 'options',
            },
          },
          {
            id: 'resource',
            accessorFn: (info) =>
              info.edorg
                ? `Ed-Org - ${info.edorg.displayName}`
                : info.ods
                ? `Ods - ${info.ods.displayName}`
                : `Environment - ${info.sbe?.displayName}`,
            header: 'Resource',
            cell: ({ row: { original } }) =>
              original.edorg
                ? original.edorg.displayName
                : original.ods
                ? original.ods.displayName
                : original.sbe
                ? original.sbe.displayName
                : '-',
            meta: {
              type: 'options',
            },
          },
          {
            accessorFn: (info) => (info.created ? Number(info.created) : null),
            cell: ValueAsDate(),
            header: 'Created',
            meta: {
              type: 'date',
            },
          },
        ]}
      />
    </PageTemplate>
  );
};
