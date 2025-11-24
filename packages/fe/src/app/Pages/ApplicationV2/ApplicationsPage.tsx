import { Fragment } from 'react/jsx-runtime';
import {
  CappedLinesText,
  PageActions,
  PageTemplate,
  SbaaTableAllInOne,
} from '@edanalytics/common-ui';
import { GetClaimsetMultipleDtoV2, GetEdorgDto, GetOdsDto, edorgKeyV2 } from '@edanalytics/models';
import {
  claimsetQueriesV2,
  edorgQueries,
  odsQueries,
  profileQueriesV2,
  vendorQueriesV2,
} from '../../api';

import { useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { ClaimsetLinkV2, EdorgLink, OdsLink, ProfileLink, VendorLinkV2 } from '../../routes';
import { NameCell } from './NameCell';
import { useMultiApplicationActions } from './useApplicationActions';
import { useGetManyApplications } from '../../api-v2';

export const ApplicationsPageV2 = () => {
  return (
    <PageTemplate title="Applications" actions={<ApplicationsPageActions />}>
      <AllApplicationsTable />
    </PageTemplate>
  );
};

export const ApplicationsPageActions = () => {
  const { edfiTenantId, asId } = useTeamEdfiTenantNavContextLoaded();

  const actions = useMultiApplicationActions({
    edfiTenantId: edfiTenantId,
    teamId: asId,
  });
  return <PageActions actions={actions} />;
};

export const AllApplicationsTable = () => {
  const { asId, edfiTenantId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  const { data: applications } = useGetManyApplications({
    queryArgs: { edfiTenantId, teamId: asId },
  });

  const edorgs = useQuery(edorgQueries.getAll({ edfiTenant, teamId: asId }));
  const odss = useQuery(odsQueries.getAll({ edfiTenant, teamId: asId }));

  const odssByInstanceId = {
    ...odss,
    data: Object.values(odss.data ?? {}).reduce<Record<string, GetOdsDto>>((map, ods) => {
      map[ods.odsInstanceId!] = ods;
      return map;
    }, {}),
  };
  const edorgsByEdorgId = {
    ...edorgs,
    data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>((map, edorg) => {
      map[
        edorgKeyV2({
          edorg: edorg.educationOrganizationId,
          ods: edorg.odsInstanceId,
        })
      ] = edorg;
      return map;
    }, {}),
  };
  const vendors = useQuery(
    vendorQueriesV2.getAll({
      teamId: asId,
      edfiTenant: edfiTenant,
    })
  );
  const profiles = useQuery(
    profileQueriesV2.getAll({
      teamId: asId,
      edfiTenant: edfiTenant,
    })
  );

  const claimsets = useQuery(
    claimsetQueriesV2.getAll({
      teamId: asId,
      edfiTenant: edfiTenant,
    })
  );
  const claimsetsByName = {
    ...claimsets,
    data: Object.values(claimsets.data ?? {}).reduce<Record<string, GetClaimsetMultipleDtoV2>>(
      (map, claimset) => {
        map[claimset.name] = claimset;
        return map;
      },
      {}
    ),
  };

  return (
    <SbaaTableAllInOne
      data={applications ?? []}
      columns={[
        {
          accessorKey: 'applicationName',
          cell: NameCell,
          header: 'Name',
        },
        {
          id: 'edorg',
          accessorFn: (application) =>
            application.educationOrganizationIds
              .flatMap((edorgId) =>
                application.odsInstanceIds.map((odsInstanceId) =>
                  getRelationDisplayName(
                    edorgKeyV2({
                      edorg: edorgId,
                      ods: odsInstanceId,
                    }),
                    edorgsByEdorgId
                  )
                )
              )
              .join(', '),
          header: 'Education organization',
          cell: (info) => {
            const { educationOrganizationIds, odsInstanceIds } = info.row.original;
            const addCommas = educationOrganizationIds.length > 1;
            return (
              <CappedLinesText maxLines={2}>
                {educationOrganizationIds.flatMap((edorgId, index) =>
                  odsInstanceIds.map((odsInstanceId) => (
                    <Fragment key={edorgId}>
                      <EdorgLink
                        id={edorgKeyV2({
                          edorg: edorgId,
                          ods: odsInstanceId,
                        })}
                        query={edorgsByEdorgId}
                      />
                      {addCommas && index < educationOrganizationIds.length - 1 ? ', ' : ''}
                    </Fragment>
                  ))
                )}
              </CappedLinesText>
            );
          },
          meta: {
            type: 'options',
          },
        },
        {
          id: 'ods',
          accessorFn: (application) =>
            application.odsInstanceIds
              .map((odsInstanceId) => getRelationDisplayName(odsInstanceId, odssByInstanceId))
              .join(', '),
          header: 'Ods',
          cell: (info) => {
            const { odsInstanceIds } = info.row.original;
            const addCommas = odsInstanceIds.length > 1;
            return (
              <>
                {odsInstanceIds.map((odsInstanceId, index) => (
                  <Fragment key={odsInstanceId}>
                    <OdsLink id={odsInstanceId} query={odssByInstanceId} />
                    {addCommas && index < odsInstanceIds.length - 1 ? ', ' : ''}
                  </Fragment>
                ))}
              </>
            );
          },
          meta: {
            type: 'options',
          },
        },
        {
          id: 'vendor',
          accessorFn: (info) => getRelationDisplayName(info.vendorId, vendors),
          header: 'Vendor',
          cell: (info) => <VendorLinkV2 query={vendors} id={info.row.original.vendorId} />,
          meta: {
            type: 'options',
          },
        },
        {
          id: 'profiles',
          accessorFn: (application) =>
            application.profileIds
              .map((profileId) => getRelationDisplayName(profileId, profiles))
              .join(', '),
          header: 'Profiles',
          cell: (info) => {
            const { profileIds } = info.row.original;
            const addCommas = profileIds.length > 1;
            return (
              <>
                {profileIds.map((profileId, index) => (
                  <Fragment key={profileId}>
                    <ProfileLink query={profiles} id={profileId} />
                    {addCommas && index < profileIds.length - 1 ? ', ' : ''}
                  </Fragment>
                ))}
              </>
            );
          },
        },
        {
          id: 'claimset',
          accessorFn: (info) => getRelationDisplayName(info.claimSetName, claimsetsByName),
          header: 'Claimset',
          cell: (info) => (
            <ClaimsetLinkV2 query={claimsetsByName} id={info.row.original.claimSetName} />
          ),
          meta: {
            type: 'options',
          },
        },
        {
          id: 'integrationProvider',
          header: 'Integration Provider',
          accessorKey: 'integrationProviderName',
        },
      ]}
    />
  );
};
