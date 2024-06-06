import {
  CappedLinesText,
  PageActions,
  PageTemplate,
  SbaaTableAllInOne,
} from '@edanalytics/common-ui';
import { GetClaimsetMultipleDtoV2, GetEdorgDto, GetOdsDto, edorgKeyV2 } from '@edanalytics/models';
import {
  applicationQueriesV2,
  claimsetQueriesV2,
  edorgQueries,
  odsQueries,
  vendorQueriesV2,
} from '../../api';

import { useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { ClaimsetLinkV2, EdorgLink, OdsLink, VendorLinkV2 } from '../../routes';
import { NameCell } from './NameCell';
import { useMultiApplicationActions } from './useApplicationActions';

export const ApplicationsPageV2 = () => {
  return (
    <PageTemplate title="Applications" actions={<ApplicationsPageActions />}>
      <ApplicationsPageContent />
    </PageTemplate>
  );
};

export const ApplicationsPageActions = () => {
  const { edfiTenantId, asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  const actions = useMultiApplicationActions({
    edfiTenantId: edfiTenantId,
    teamId: asId,
  });
  return <PageActions actions={actions} />;
};

export const ApplicationsPageContent = () => {
  const { edfiTenantId, asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  const applications = useQuery(
    applicationQueriesV2.getAll({
      edfiTenant: edfiTenant,
      teamId: asId,
    })
  );
  const edorgs = useQuery(
    edorgQueries.getAll({
      edfiTenant: edfiTenant,
      teamId: asId,
    })
  );
  const odss = useQuery(
    odsQueries.getAll({
      edfiTenant: edfiTenant,
      teamId: asId,
    })
  );
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
      data={Object.values(applications?.data || {})}
      columns={[
        {
          accessorKey: 'displayName',
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
          cell: (info) => (
            <CappedLinesText maxLines={2}>
              {info.row.original.educationOrganizationIds
                .flatMap((edorgId) =>
                  info.row.original.odsInstanceIds.map((odsInstanceId) => (
                    <EdorgLink
                      key={edorgId}
                      id={edorgKeyV2({
                        edorg: edorgId,
                        ods: odsInstanceId,
                      })}
                      query={edorgsByEdorgId}
                    />
                  ))
                )
                .reduce((prev, curr) => [prev, ', ', curr] as any)}
            </CappedLinesText>
          ),
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
          cell: (info) => (
            <>
              {info.row.original.odsInstanceIds
                .map((odsInstanceId) => (
                  <OdsLink key={odsInstanceId} id={odsInstanceId} query={odssByInstanceId} />
                ))
                .reduce((prev, curr) => [prev, ', ', curr] as any)}
            </>
          ),
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
          accessorFn: (info) => info.profileIds?.join(', ') ?? undefined,
          header: 'Profile IDs',
        },
        {
          id: 'claimest',
          accessorFn: (info) => getRelationDisplayName(info.claimSetName, claimsetsByName),
          header: 'Claimset',
          cell: (info) => (
            <ClaimsetLinkV2 query={claimsetsByName} id={info.row.original.claimSetName} />
          ),
          meta: {
            type: 'options',
          },
        },
      ]}
    />
  );
};
