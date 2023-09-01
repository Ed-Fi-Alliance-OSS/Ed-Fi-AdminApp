import { Link, Text } from '@chakra-ui/react';
import { SbaaTableAllInOne, PageTemplate } from '@edanalytics/common-ui';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { ownershipQueries, roleQueries, userQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { RoleLink, UserLink } from '../../routes';

export const OwnershipsPage = () => {
  const params = useParams() as { asId: string };
  const ownerships = ownershipQueries.useAll({
    tenantId: params.asId,
  });
  const users = userQueries.useAll({ tenantId: params.asId });
  const roles = roleQueries.useAll({ tenantId: params.asId });

  return (
    <PageTemplate title="Ownerships">
      <SbaaTableAllInOne
        data={Object.values(ownerships?.data || {})}
        columns={[
          {
            id: 'role',
            accessorFn: (info) => getRelationDisplayName(info.roleId, roles),
            header: 'Role',
            cell: (info) => <RoleLink query={roles} id={info.row.original.roleId} />,
          },
          {
            id: 'resource',
            accessorFn: (info) =>
              info.edorg
                ? `Ed-Org - ${info.edorg.displayName}`
                : info.ods
                ? `Ods - ${info.ods.displayName}`
                : `Environment - ${info.sbe?.displayName}`,
            header: 'Resource',
            cell: ({ row: { original } }) =>
              original.edorg ? (
                <Link as="span">
                  <RouterLink
                    title="Go to edorg"
                    to={`/as/${params.asId}/sbes/${original.edorg.sbeId}/odss/${original.edorg.id}`}
                  >
                    {`Ed-Org - ${original.edorg.displayName}`}
                  </RouterLink>
                </Link>
              ) : original.ods ? (
                <Link as="span">
                  <RouterLink
                    title="Go to ods"
                    to={`/as/${params.asId}/sbes/${original.ods.sbeId}/odss/${original.ods.id}`}
                  >
                    {`ODS - ${original.ods.displayName}`}
                  </RouterLink>
                </Link>
              ) : original.sbe ? (
                <Link as="span">
                  <RouterLink title="Go to sbe" to={`/as/${params.asId}/sbes/${original.sbe.id}`}>
                    {`Environment - ${original.sbe.displayName}`}
                  </RouterLink>
                </Link>
              ) : (
                <Text title="Edorg may have been deleted." as="i" color="gray.500">
                  not found
                </Text>
              ),
          },
          {
            id: 'modifiedBy',
            accessorFn: (info) => getRelationDisplayName(info.modifiedById, users),
            header: 'Modified by',
            cell: (info) => <UserLink query={users} id={info.row.original.modifiedById} />,
          },
          {
            accessorKey: 'createdDetailed',
            header: 'Created',
          },
          {
            id: 'createdBy',
            accessorFn: (info) => getRelationDisplayName(info.createdById, users),
            header: 'Created by',
            cell: (info) => <UserLink query={users} id={info.row.original.createdById} />,
          },
        ]}
      />
    </PageTemplate>
  );
};
