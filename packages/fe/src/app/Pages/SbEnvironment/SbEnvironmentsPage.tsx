import { PageTemplate, SbaaTableAllInOne, ValueAsDate } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { sbEnvironmentQueries, userQueries } from '../../api';
import {
  globalUserAuthConfig,
  teamUserAuthConfig,
  useAuthorize,
  useNavContext,
} from '../../helpers';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { UserLink } from '../../routes';
import { NameCell } from './NameCell';

export const SbEnvironmentsPage = () => {
  return (
    <PageTemplate title="Environments">
      <SbEnvironmentsTable />
    </PageTemplate>
  );
};

export const SbEnvironmentsTable = () => {
  const { teamId } = useNavContext();
  const sbEnvironments = useQuery(
    sbEnvironmentQueries.getAll({
      teamId,
    })
  );
  const userAuth = useAuthorize(
    teamId === undefined
      ? globalUserAuthConfig('user:read')
      : teamUserAuthConfig('__filtered__', teamId, 'team.user:read')
  );
  const users = useQuery(userQueries.getAll({ teamId, enabled: userAuth }));

  return (
    <SbaaTableAllInOne
      data={Object.values(sbEnvironments?.data || {})}
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
          accessorKey: 'odsApiVersion',
          header: 'API version',
          meta: {
            type: 'options',
          },
        },
        {
          accessorKey: 'odsDsVersion',
          header: 'Data standard',
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
