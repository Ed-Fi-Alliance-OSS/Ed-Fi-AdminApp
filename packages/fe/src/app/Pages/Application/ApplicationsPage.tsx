import { PageActions, PageTemplate, SbaaTableAllInOne } from '@edanalytics/common-ui';
import { GetClaimsetDto, GetEdorgDto, createEdorgCompositeNaturalKey } from '@edanalytics/models';
import { applicationQueries, claimsetQueries, edorgQueries, vendorQueries } from '../../api';

import { useNavContext } from '../../helpers';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { ClaimsetLink, EdorgLink, VendorLink } from '../../routes';
import { NameCell } from './NameCell';
import { useMultiApplicationActions } from './useApplicationActions';

export const ApplicationsPage = () => {
  return (
    <PageTemplate title="Applications" actions={<ApplicationsPageActions />}>
      <ApplicationsPageContent />
    </PageTemplate>
  );
};

export const ApplicationsPageActions = () => {
  const navContext = useNavContext();
  const sbeId = navContext.sbeId!;
  const asId = navContext.asId!;

  const actions = useMultiApplicationActions({
    sbeId: sbeId,
    tenantId: asId,
  });
  return <PageActions actions={actions} />;
};

export const ApplicationsPageContent = () => {
  const navContext = useNavContext();
  const sbeId = navContext.sbeId!;
  const asId = navContext.asId!;

  const applications = applicationQueries.useAll({
    sbeId: sbeId,
    tenantId: asId,
  });
  const edorgs = edorgQueries.useAll({
    sbeId: sbeId,
    tenantId: asId,
  });
  const edorgsByEdorgId = {
    ...edorgs,
    data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>((map, edorg) => {
      map[
        createEdorgCompositeNaturalKey({
          educationOrganizationId: edorg.educationOrganizationId,
          odsDbName: edorg.odsDbName,
        })
      ] = edorg;
      return map;
    }, {}),
  };
  const vendors = vendorQueries.useAll({
    sbeId: sbeId,
    tenantId: asId,
  });
  const claimsets = claimsetQueries.useAll({
    sbeId: sbeId,
    tenantId: asId,
  });
  const claimsetsByName = {
    ...claimsets,
    data: Object.values(claimsets.data ?? {}).reduce<Record<string, GetClaimsetDto>>(
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
            application._educationOrganizationIds
              .map((edorgId) =>
                getRelationDisplayName(
                  createEdorgCompositeNaturalKey({
                    educationOrganizationId: edorgId,
                    odsDbName: 'EdFi_Ods_' + application.odsInstanceName,
                  }),
                  edorgsByEdorgId
                )
              )
              .join(', '),
          header: 'Education organization',
          cell: (info) => (
            <>
              {info.row.original._educationOrganizationIds
                .map((edorgId) => (
                  <EdorgLink
                    key={edorgId}
                    id={createEdorgCompositeNaturalKey({
                      educationOrganizationId: edorgId,
                      odsDbName: 'EdFi_Ods_' + info.row.original.odsInstanceName,
                    })}
                    query={edorgsByEdorgId}
                  />
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
          cell: (info) => <VendorLink query={vendors} id={info.row.original.vendorId} />,
          meta: {
            type: 'options',
          },
        },
        {
          id: 'claimest',
          accessorFn: (info) => getRelationDisplayName(info.claimSetName, claimsetsByName),
          header: 'Claimset',
          cell: (info) => (
            <ClaimsetLink
              query={claimsets}
              id={claimsetsByName.data[info.row.original.claimSetName]?.id}
            />
          ),
          meta: {
            type: 'options',
          },
        },
      ]}
    />
  );
};
