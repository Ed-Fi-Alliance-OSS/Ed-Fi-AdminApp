import { PageActions, PageTemplate, SbaaTableAllInOne, ValueAsDate } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import omit from 'lodash/omit';
import { roleQueries, teamQueries, userQueries, userTeamMembershipQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { TeamLink, UserGlobalLink } from '../../routes';
import { RoleGlobalLink } from '../../routes/role-global.routes';
import { UtmGlobalNameCell } from './UtmGlobalNameCell';
import { useUtmsActionsGlobal } from './useUtmsActionsGlobal';

export const UtmsGlobalPage = () => {
  const userTeamMemberships = useQuery(userTeamMembershipQueries.getAll({}));
  const users = useQuery(userQueries.getAll({}));
  const teams = useQuery(teamQueries.getAll({}));
  const roles = useQuery(roleQueries.getAll({}));
  const actions = useUtmsActionsGlobal();
  const usersByUserId = Object.values(users?.data || {});
  return (
    <PageTemplate
      title="Team memberships"
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      <SbaaTableAllInOne
        data={Object.values(userTeamMemberships?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: UtmGlobalNameCell,
            header: '',
            enableSorting: false,
          },
          {
            id: 'team',
            accessorFn: (info) => getRelationDisplayName(info.teamId, teams),
            header: 'Team',
            cell: (info) => <TeamLink id={info.row.original.teamId} query={teams} />,
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            id: 'user',
            accessorFn: (info) => getRelationDisplayName(info.userId, users),
            header: 'User',
            cell: (info) => <UserGlobalLink id={info.row.original.userId} />,
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            id: 'username',
            accessorFn: (info) => usersByUserId?.find((user) => user.id === info.userId)?.username,
            header: 'username',
            cell: (info) => <UserGlobalLink id={info.row.original.userId} displayUsername={true} />,
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
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
            id: 'createdDetailed',
            accessorKey: 'createdNumber',
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
