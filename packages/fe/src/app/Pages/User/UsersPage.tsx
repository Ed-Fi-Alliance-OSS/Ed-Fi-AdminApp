import { HStack } from '@chakra-ui/react';
import {
  SbaaTableAllInOne,
  PageTemplate,
  TableRowActions,
  ValueAsDate,
} from '@edanalytics/common-ui';

import { GetUserTenantMembershipDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { useParams } from 'react-router-dom';
import { roleQueries, userQueries, userTenantMembershipQueries } from '../../api';
import { getEntityFromQuery } from '../../helpers';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { useReadTenantEntity } from '../../helpers/useStandardRowActionsNew';
import { UserLink, userRoute } from '../../routes';

const NameCell = (info: CellContext<GetUserTenantMembershipDto, unknown>) => {
  const params = useParams() as { asId: string };
  const users = userQueries.useAll({
    tenantId: params.asId,
  });

  const View = useReadTenantEntity({
    entity: info.row.original,
    params: { ...params, userId: info.row.original.id },
    privilege: 'tenant.user:read',
    route: userRoute,
  });
  const actions = {
    ...(View ? { View } : undefined),
  };
  return (
    <HStack justify="space-between">
      <UserLink id={info.row.original.userId} query={users} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
export const UsersPage = () => {
  const params = useParams() as { asId: string };
  const users = userQueries.useAll({
    tenantId: params.asId,
  });

  const roles = roleQueries.useAll({ tenantId: params.asId });

  const userTenantMemberships = userTenantMembershipQueries.useAll({
    tenantId: params.asId,
  });

  return (
    <PageTemplate title="Users">
      <SbaaTableAllInOne
        data={Object.values(userTenantMemberships?.data || {})}
        columns={[
          {
            id: 'displayName',
            accessorFn: (info) => getRelationDisplayName(info.userId, users),
            cell: NameCell,
            header: 'Name',
          },
          {
            id: 'username',
            accessorFn: (info) => getEntityFromQuery(info.userId, users)?.username,
            cell: (info) => getEntityFromQuery(info.row.original.userId, users)?.username,
            header: 'Username',
          },
          {
            id: 'role',
            accessorFn: (info) => getRelationDisplayName(info.roleId, roles),
            cell: (info) => getRelationDisplayName(info.row.original.roleId, roles),
            header: 'Tenant role',
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
    </PageTemplate>
  );
};
