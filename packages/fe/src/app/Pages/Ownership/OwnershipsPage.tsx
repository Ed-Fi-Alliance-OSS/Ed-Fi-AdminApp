import { Heading, Text, HStack, Link } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import {
  UserLink,
  ownershipRoute,
  ownershipsRoute,
  OwnershipLink,
  RoleLink,
  EdorgLink,
  edorgRoute,
  odsRoute,
  sbeRoute,
} from '../../routes';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, Link as RouterLink } from '@tanstack/router';
import {
  edorgQueries,
  odsQueries,
  ownershipQueries,
  roleQueries,
  sbeQueries,
  userQueries,
} from '../../api';

export const OwnershipsPage = () => {
  const params = useParams({ from: ownershipsRoute.id });
  const ownerships = ownershipQueries.useAll({
    tenantId: params.asId,
  });
  const deleteOwnership = ownershipQueries.useDelete({
    tenantId: params.asId,
  });
  const users = userQueries.useAll({ tenantId: params.asId });
  const roles = roleQueries.useAll({ tenantId: params.asId });
  const sbes = sbeQueries.useAll({
    tenantId: params.asId,
  });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        Ownerships
      </Heading>
      <DataTable
        data={Object.values(ownerships?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: (info) => (
              <HStack justify="space-between">
                <OwnershipLink id={info.row.original.id} query={ownerships} />
                <HStack className="row-hover" color="gray.600" align="middle">
                  <StandardRowActions
                    info={info}
                    mutation={deleteOwnership.mutate}
                    route={ownershipRoute}
                    params={(params: any) => ({
                      ...params,
                      ownershipId: String(info.row.original.id),
                    })}
                  />
                </HStack>
              </HStack>
            ),
            header: () => 'Name',
          },
          {
            id: 'role',
            accessorFn: (info) => getRelationDisplayName(info.roleId, roles),
            header: () => 'Role',
            cell: (info) => (
              <RoleLink query={roles} id={info.row.original.roleId} />
            ),
          },
          {
            id: 'resource',
            accessorFn: (info) =>
              info.resource.edorg
                ? `Ed-Org - ${info.resource.edorg.displayName}`
                : info.resource.ods
                ? `Ods - ${info.resource.ods.displayName}`
                : `Environment - ${info.resource.sbe?.displayName}`,
            header: () => 'Resource',
            cell: ({
              row: {
                original: { resource },
              },
            }) =>
              resource.edorg ? (
                <Link as="span">
                  <RouterLink
                    title="Go to edorg"
                    to={edorgRoute.fullPath}
                    params={{
                      asId: params.asId,
                      sbeId: String(resource.edorg.sbeId),
                      edorgId: String(resource.edorg.id),
                    }}
                  >
                    {`Ed-Org - ${resource.edorg.displayName}`}
                  </RouterLink>
                </Link>
              ) : resource.ods ? (
                <Link as="span">
                  <RouterLink
                    title="Go to ods"
                    to={odsRoute.fullPath}
                    params={{
                      asId: params.asId,
                      sbeId: String(resource.ods.sbeId),
                      odsId: String(resource.ods.id),
                    }}
                  >
                    {`ODS - ${resource.ods.displayName}`}
                  </RouterLink>
                </Link>
              ) : resource.sbe ? (
                <Link as="span">
                  <RouterLink
                    title="Go to sbe"
                    to={sbeRoute.fullPath}
                    params={{
                      asId: params.asId,
                      sbeId: String(resource.sbe.id),
                    }}
                  >
                    {`Environment - ${resource.sbe.displayName}`}
                  </RouterLink>
                </Link>
              ) : (
                <Text
                  title="Edorg may have been deleted."
                  as="i"
                  color="gray.500"
                >
                  not found
                </Text>
              ),
          },
          {
            id: 'modifiedBy',
            accessorFn: (info) =>
              getRelationDisplayName(info.modifiedById, users),
            header: () => 'Modified by',
            cell: (info) => (
              <UserLink query={users} id={info.row.original.modifiedById} />
            ),
          },
          {
            accessorKey: 'createdDetailed',
            header: () => 'Created',
          },
          {
            id: 'createdBy',
            accessorFn: (info) =>
              getRelationDisplayName(info.createdById, users),
            header: () => 'Created by',
            cell: (info) => (
              <UserLink query={users} id={info.row.original.createdById} />
            ),
          },
        ]}
      />
    </>
  );
};
