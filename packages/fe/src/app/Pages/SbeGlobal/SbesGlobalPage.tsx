import { HStack } from '@chakra-ui/react';
import {
  ActionBarActions,
  SbaaTableAllInOne,
  PageTemplate,
  TableRowActions,
  ValueAsDate,
} from '@edanalytics/common-ui';
import { GetSbeDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import _ from 'lodash';
import { sbeQueries, userQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { SbeGlobalLink, UserGlobalLink } from '../../routes';
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
      <SbaaTableAllInOne
        data={Object.values(sbes?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: SbesNameCell,
            header: 'Name',
          },
          {
            id: 'modifiedBy',
            accessorFn: (info) => getRelationDisplayName(info.modifiedById, users),
            header: 'Modified by',
            cell: (info) => <UserGlobalLink query={users} id={info.row.original.modifiedById} />,
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
            cell: (info) => <UserGlobalLink query={users} id={info.row.original.createdById} />,
            meta: {
              type: 'options',
            },
          },
        ]}
      />
    </PageTemplate>
  );
};
