import { PageActions, PageTemplate, SbaaTableAllInOne } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { odsQueries } from '../../api/queries/queries';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { NameCell } from './NameCell';
import { useOdssActions } from './useOdssActions';

export const OdssPage = () => {
  const actions = useOdssActions();
  return (
    <PageTemplate actions={<PageActions actions={actions} />} title="Operational Data Stores">
      <OdssTable />
    </PageTemplate>
  );
};

export const OdssTable = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const odss = useQuery(
    odsQueries.getAll({
      edfiTenant,
      teamId,
    })
  );

  return (
    <SbaaTableAllInOne
      data={Object.values(odss?.data || {})}
      columns={[
        {
          accessorKey: 'displayName',
          cell: NameCell,
          header: 'Name',
        },
      ]}
    />
  );
};
