import { SbaaTableAllInOne, ValueAsDate } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { roleQueries, userQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { RoleGlobalLink } from '../../routes/role-global.routes';
import { UsersTableNameCell } from './UsersTableNameCell';

export const MachineUsersTable = () => {
  const users = useQuery(userQueries.getAll({}));
  const roles = useQuery(roleQueries.getAll({}));

  const machineUsers = Object.values(users?.data || {}).filter(
    (user) => user.userType === 'machine'
  );

  return (
    <SbaaTableAllInOne
      data={machineUsers}
      queryKeyPrefix="machineUsers"
      columns={[
        {
          accessorKey: 'username',
          cell: UsersTableNameCell,
          header: 'Username',
        },
        {
          accessorKey: 'clientId',
          header: 'Client ID',
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
