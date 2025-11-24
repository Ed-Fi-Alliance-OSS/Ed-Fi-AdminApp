import { PageActions, PageTemplate, SbaaTableAllInOne } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { ownershipQueries, roleQueries, teamQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { TeamLink } from '../../routes';
import { RoleGlobalLink } from '../../routes/role-global.routes';
import { OwnershipsNameCell } from './OwnershipsNameCell';
import { useMultipleOwnershipGlobalActions } from './useMultipleOwnershipGlobalActions';

export const OwnershipsGlobalPage = () => {
  const ownerships = useQuery(ownershipQueries.getAll({}));
  const roles = useQuery(roleQueries.getAll({}));
  const teams = useQuery(teamQueries.getAll({}));
  const actions = useMultipleOwnershipGlobalActions();

  return (
    <PageTemplate title="Resource ownerships" actions={<PageActions actions={actions} />}>
      <SbaaTableAllInOne
        data={Object.values(ownerships?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: OwnershipsNameCell,
            header: 'Name',
          },
          {
            id: 'team',
            accessorFn: (info) => getRelationDisplayName(info.teamId, teams),
            header: 'Team',
            cell: (info) => <TeamLink id={info.row.original.teamId} query={teams} />,
            filterFn: 'equalsString',
            meta: { type: 'options' },
          },
          {
            id: 'role',
            accessorFn: (info) => getRelationDisplayName(info.roleId, roles),
            header: 'Role',
            cell: (info) => <RoleGlobalLink id={info.row.original.roleId} query={roles} />,
            filterFn: 'equalsString',
            meta: { type: 'options' },
          },
          {
            accessorKey: 'resourceType',
            header: 'Type',
            filterFn: 'equalsString',
            meta: { type: 'options' },
          },
          {
            accessorKey: 'resourceText',
            header: 'Resource',
          },
        ]}
      />
    </PageTemplate>
  );
};
