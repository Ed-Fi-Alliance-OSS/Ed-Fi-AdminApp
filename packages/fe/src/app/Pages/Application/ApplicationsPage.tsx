import { ActionBarActions, SbaaTableAllInOne, PageTemplate } from '@edanalytics/common-ui';
import { GetClaimsetDto, GetEdorgDto, createEdorgCompositeNaturalKey } from '@edanalytics/models';
import _ from 'lodash';
import { applicationQueries, claimsetQueries, edorgQueries, vendorQueries } from '../../api';

import { useNavContext } from '../../helpers';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { ClaimsetLink, EdorgLink, VendorLink } from '../../routes';
import { NameCell } from './NameCell';
import { useApplicationsActions } from './useApplicationActions';

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

  const actions = useApplicationsActions({
    sbeId: sbeId,
    tenantId: asId,
  });
  return <ActionBarActions actions={_.omit(actions, 'View')} />;
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
  const claimsets = claimsetQueries.useAll({
    sbeId: sbeId,
    tenantId: asId,
  });
  const vendors = vendorQueries.useAll({
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
          cell: NameCell({ asId: asId, sbeId: sbeId }),
          header: 'Name',
        },
        {
          id: 'edorg',
          accessorFn: (info) =>
            getRelationDisplayName(
              createEdorgCompositeNaturalKey({
                educationOrganizationId: info.educationOrganizationId,
                odsDbName: 'EdFi_Ods_' + info.odsInstanceName,
              }),
              edorgsByEdorgId
            ),
          header: 'Education organization',
          cell: (info) => (
            <EdorgLink
              query={edorgs}
              id={
                edorgsByEdorgId.data[
                  createEdorgCompositeNaturalKey({
                    educationOrganizationId: info.row.original.educationOrganizationId,
                    odsDbName: 'EdFi_Ods_' + info.row.original.odsInstanceName,
                  })
                ]?.id
              }
            />
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
