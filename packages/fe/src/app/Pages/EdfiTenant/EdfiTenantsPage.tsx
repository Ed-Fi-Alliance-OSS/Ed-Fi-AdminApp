import { PageActions, PageTemplate, SbaaTableAllInOne, ValueAsDate } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { edfiTenantQueries, userQueries } from '../../api';
import {
  globalUserAuthConfig,
  teamUserAuthConfig,
  useAuthorize,
  useTeamSbEnvironmentNavContext,
} from '../../helpers';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { UserLink } from '../../routes';
import { NameCell } from './NameCell';
import { useEdfiTenantsActions } from './useEdfiTenantsActions';

export const EdfiTenantsPage = () => {
  const actions = useEdfiTenantsActions();
  return (
    <PageTemplate title="Tenants" actions={<PageActions actions={actions} />}>
      <EdfiTenantsTable />
    </PageTemplate>
  );
};

export const EdfiTenantsTable = () => {
  const { asId, teamId, sbEnvironmentId } = useTeamSbEnvironmentNavContext();
  const edfiTenants = useQuery(
    edfiTenantQueries.getAll({
      teamId,
      sbEnvironmentId,
    })
  );
  const userAuth = useAuthorize(
    teamId === undefined
      ? globalUserAuthConfig('user:read')
      : teamUserAuthConfig('__filtered__', teamId, 'team.user:read')
  );
  const users = useQuery(userQueries.getAll({ teamId: asId, enabled: userAuth }));

  return (
    <SbaaTableAllInOne
      data={Object.values(edfiTenants?.data || {})}
      columns={[
        {
          accessorKey: 'displayName',
          cell: NameCell,
          header: 'Name',
        },
        {
          id: 'modifiedBy',
          accessorFn: (info) => getRelationDisplayName(info.modifiedById, users),
          header: 'Modified by',
          cell: (info) => <UserLink query={users} id={info.row.original.modifiedById} />,
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
        {
          id: 'createdBy',
          accessorFn: (info) => getRelationDisplayName(info.createdById, users),
          header: 'Created by',
          cell: (info) => <UserLink query={users} id={info.row.original.createdById} />,
          filterFn: 'equalsString',
          meta: {
            type: 'options',
          },
        },
      ]}
    />
  );
};
