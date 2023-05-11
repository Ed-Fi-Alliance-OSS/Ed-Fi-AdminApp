import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import {
  UserLink,
  applicationRoute,
  applicationsRoute,
  ApplicationLink,
  EdorgLink,
  ClaimsetLink,
} from '../../routes';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from '@tanstack/router';
import {
  applicationQueries,
  claimsetQueries,
  edorgQueries,
  userQueries,
} from '../../api';
import { GetClaimsetDto, GetEdorgDto } from '@edanalytics/models';

export const ApplicationsPage = () => {
  const params = useParams({ from: applicationsRoute.id });
  const applications = applicationQueries.useAll({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const deleteApplication = applicationQueries.useDelete({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const users = userQueries.useAll({ tenantId: params.asId });
  const edorgs = edorgQueries.useAll({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const edorgsByEdorgId = {
    ...edorgs,
    data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>(
      (map, edorg) => {
        map[edorg.educationOrganizationId] = edorg;
        return map;
      },
      {}
    ),
  };
  const claimsets = claimsetQueries.useAll({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const claimsetsByName = {
    ...claimsets,
    data: Object.values(claimsets.data ?? {}).reduce<
      Record<string, GetClaimsetDto>
    >((map, claimset) => {
      map[claimset.name] = claimset;
      return map;
    }, {}),
  };
  return (
    <>
      <Heading mb={4} fontSize="lg">
        Applications
      </Heading>
      <DataTable
        data={Object.values(applications?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: (info) => (
              <HStack justify="space-between">
                <ApplicationLink
                  id={info.row.original.id}
                  query={applications}
                  sbeId={params.sbeId}
                />
                <HStack className="row-hover" color="gray.600" align="middle">
                  {/* <StandardRowActions
                    info={info}
                    mutation={deleteApplication.mutate}
                    route={applicationRoute}
                    params={(params: any) => ({
                      ...params,
                      applicationId: String(info.row.original.id),
                    })}
                  /> */}
                </HStack>
              </HStack>
            ),
            header: () => 'Name',
          },
          {
            id: 'edorg',
            accessorFn: (info) =>
              getRelationDisplayName(
                info.educationOrganizationId,
                edorgsByEdorgId
              ),
            header: () => 'Education organization',
            cell: (info) => (
              <EdorgLink
                query={edorgs}
                id={
                  edorgsByEdorgId.data[
                    info.row.original.educationOrganizationId
                  ]?.id
                }
              />
            ),
          },
          {
            id: 'claimest',
            accessorFn: (info) =>
              getRelationDisplayName(info.claimSetName, claimsetsByName),
            header: () => 'Claimset',
            cell: (info) => (
              <ClaimsetLink
                query={claimsets}
                id={claimsetsByName.data[info.row.original.claimSetName]?.id}
                sbeId={params.sbeId}
              />
            ),
          },
        ]}
      />
    </>
  );
};
