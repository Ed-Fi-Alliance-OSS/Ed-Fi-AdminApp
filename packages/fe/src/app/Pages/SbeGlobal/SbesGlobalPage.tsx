import { HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { GetSbeDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import _ from 'lodash';
import { sbeQueries, userQueries } from '../../api';
import { ActionBarActions } from '../../helpers';
import { TableRowActions } from '../../helpers/TableRowActions';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { SbeGlobalLink, UserGlobalLink } from '../../routes';
import { PageTemplate } from '../PageTemplate';
import { useSbeGlobalActions } from './useSbeGlobalActions';
import { useSbesGlobalActions } from './useSbesGlobalActions';

const SbesNameCell = (info: CellContext<GetSbeDto, unknown>) => {
  const sbes = sbeQueries.useAll({});
  const actions = useSbeGlobalActions(info.row.original);
  return (
    <HStack justify="space-between">
      <SbeGlobalLink id={info.row.original.id} query={sbes} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};

export const SbesGlobalPage = () => {
  const sbes = sbeQueries.useAll({});
  const users = userQueries.useAll({ optional: true });
  const actions = useSbesGlobalActions();
  return (
    <PageTemplate
      actions={<ActionBarActions actions={_.omit(actions, 'View')} />}
      title="Starting Blocks environments"
    >
      <DataTable
        data={Object.values(sbes?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: SbesNameCell,
            header: () => 'Name',
          },
          {
            id: 'modifiedBy',
            accessorFn: (info) => getRelationDisplayName(info.modifiedById, users),
            header: () => 'Modified by',
            cell: (info) => <UserGlobalLink query={users} id={info.row.original.modifiedById} />,
          },
          {
            accessorKey: 'createdDetailed',
            header: () => 'Created',
          },
          {
            id: 'createdBy',
            accessorFn: (info) => getRelationDisplayName(info.createdById, users),
            header: () => 'Created by',
            cell: (info) => <UserGlobalLink query={users} id={info.row.original.createdById} />,
          },
        ]}
      />
    </PageTemplate>
  );
};
