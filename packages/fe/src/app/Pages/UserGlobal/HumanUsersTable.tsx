import { SbaaTableAllInOne, ValueAsDate } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { roleQueries, userQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { RoleGlobalLink } from '../../routes/role-global.routes';
import { UsersTableNameCell } from './UsersTableNameCell';

export const HumanUsersTable = () => {
  const users = useQuery(userQueries.getAll({}));
  const roles = useQuery(roleQueries.getAll({}));

  const humanUsers = Object.values(users?.data || {}).filter((user) => user.userType === 'human');

  return (
    <SbaaTableAllInOne
      data={humanUsers}
      isFixedHeightForPagination
      columns={[
        {
          accessorKey: 'displayName',
          cell: UsersTableNameCell,
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
          filterFn: 'equalsString',
          meta: {
            type: 'options',
          },
        },
        {
          accessorKey: 'createdNumber',
          cell: ValueAsDate(),
          header: 'Created',
          meta: {
            type: 'date',
          },
        },
      ]}
    />
  );
};
