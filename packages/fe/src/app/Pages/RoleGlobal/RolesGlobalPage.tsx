import { HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { GetRoleDto, RoleType } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { useParams } from 'react-router-dom';
import { roleQueries, useMyTenants, userQueries } from '../../api';
import { TableRowActions } from '../../helpers/TableRowActions';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { UserLink } from '../../routes';
import { RoleGlobalLink } from '../../routes/role-global.routes';
import { PageTemplate } from '../PageTemplate';
import { useRoleGlobalActions } from './useRoleGlobalActions';
import { useMultipleRoleGlobalActions } from './useMultipleRoleGlobalActions';
import { ActionBarActions } from '../../helpers';

const NameCell = (info: CellContext<GetRoleDto, unknown>) => {
  const params = useParams() as { asId: string };
  const entities = roleQueries.useAll({
    tenantId: params.asId,
  });
  const actions = useRoleGlobalActions(info.row.original);
  return (
    <HStack justify="space-between">
      <RoleGlobalLink id={info.row.original.id} query={entities} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};

export const RolesGlobalPage = () => {
  const params = useParams();
  const roles = roleQueries.useAll({
    tenantId: params.asId,
  });
  const users = userQueries.useAll({ tenantId: params.asId });
  const tenants = useMyTenants();
  const actions = useMultipleRoleGlobalActions();
  return (
    <PageTemplate title="Roles" justifyActionsLeft actions={<ActionBarActions actions={actions} />}>
      <DataTable
        data={Object.values(roles?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: NameCell,
            header: () => 'Name',
          },
          {
            id: 'type',
            accessorFn: (info) => RoleType[info.type],
            header: () => 'Type',
          },
          {
            id: 'owned-by',
            accessorFn: (info) =>
              typeof info.tenantId === 'number'
                ? getRelationDisplayName(info.tenantId, tenants)
                : 'Public',
            header: () => 'Owned by',
          },
          {
            id: 'modifiedBy',
            accessorFn: (info) => getRelationDisplayName(info.modifiedById, users),
            header: () => 'Modified by',
            cell: (info) => <UserLink query={users} id={info.row.original.modifiedById} />,
          },
          {
            accessorKey: 'createdDetailed',
            header: () => 'Created',
          },
          {
            id: 'createdBy',
            accessorFn: (info) => getRelationDisplayName(info.createdById, users),
            header: () => 'Created by',
            cell: (info) => <UserLink query={users} id={info.row.original.createdById} />,
          },
        ]}
      />
    </PageTemplate>
  );
};
