import { HStack } from '@chakra-ui/react';
import {
  PageActions,
  SbaaTableAllInOne,
  PageTemplate,
  TableRowActions,
  ValueAsDate,
} from '@edanalytics/common-ui';
import { GetTenantDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';

import omit from 'lodash/omit';
import { tenantQueries, userQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { TenantLink, UserGlobalLink } from '../../routes';
import { useTenantActions } from './useTenantActions';
import { useTenantsActions } from './useTenantsActions';

const TenantNameCell = (info: CellContext<GetTenantDto, unknown>) => {
  const tenants = tenantQueries.useAll({});
  const actions = useTenantActions(info.row.original);
  return (
    <HStack justify="space-between">
      <TenantLink id={info.row.original.id} query={tenants} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};

export const TenantsPage = () => {
  const tenants = tenantQueries.useAll({});
  const users = userQueries.useAll({ optional: true });
  const actions = useTenantsActions();

  return (
    <PageTemplate title="Tenants" actions={<PageActions actions={omit(actions, 'View')} />}>
      <SbaaTableAllInOne
        data={Object.values(tenants?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: TenantNameCell,
            header: 'Name',
          },
          {
            id: 'modifiedBy',
            accessorFn: (info) => getRelationDisplayName(info.modifiedById, users),
            header: 'Modified by',
            cell: (info) => <UserGlobalLink id={info.row.original.modifiedById} />,
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
            cell: (info) => <UserGlobalLink id={info.row.original.createdById} />,
            meta: {
              type: 'options',
            },
          },
        ]}
      />
    </PageTemplate>
  );
};
