import { HStack } from '@chakra-ui/react';
import {
  ActionBarActions,
  SbaaTableAllInOne,
  PageTemplate,
  TableRowActions,
  ValueAsDate,
} from '@edanalytics/common-ui';
import { GetUserDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { roleQueries, tenantQueries, userQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { UserGlobalLink } from '../../routes';
import { RoleGlobalLink } from '../../routes/role-global.routes';
import { useMultipleUserGlobalActions } from './useMultipleUserGlobalActions';
import { useUserGlobalActions } from './useUserGlobalActions';

const NameCell = (info: CellContext<GetUserDto, unknown>) => {
  const users = userQueries.useAll({});
  const actions = useUserGlobalActions(info.row.original);
  return (
    <HStack justify="space-between">
      <UserGlobalLink id={info.row.original.id} query={users} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};

export const UsersGlobalPage = () => {
  const users = userQueries.useAll({});
  const roles = roleQueries.useAll({});
  const tenants = tenantQueries.useAll({});
  const actions = useMultipleUserGlobalActions();
  return (
    <PageTemplate title="Users" actions={<ActionBarActions actions={actions} />}>
      <SbaaTableAllInOne
        data={Object.values(users?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: NameCell,
            header: 'Name',
          },
          {
            accessorKey: 'username',
            header: 'Username',
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
