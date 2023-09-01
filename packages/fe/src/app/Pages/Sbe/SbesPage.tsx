import { SbaaTableAllInOne, PageTemplate, ValueAsDate } from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { sbeQueries, userQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { UserLink } from '../../routes';
import { NameCell } from './NameCell';

export const SbesPage = () => {
  const params = useParams();
  const sbes = sbeQueries.useAll({
    tenantId: params.asId,
  });
  const users = userQueries.useAll({ tenantId: params.asId });

  return (
    <PageTemplate title="Starting Blocks environments">
      <SbaaTableAllInOne
        data={Object.values(sbes?.data || {})}
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
          {
            id: 'createdBy',
            accessorFn: (info) => getRelationDisplayName(info.createdById, users),
            header: 'Created by',
            cell: (info) => <UserLink query={users} id={info.row.original.createdById} />,
            meta: {
              type: 'options',
            },
          },
        ]}
      />
    </PageTemplate>
  );
};
