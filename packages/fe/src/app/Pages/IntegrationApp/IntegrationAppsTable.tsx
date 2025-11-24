import { SbaaTableAllInOne } from '@edanalytics/common-ui';
import { useGetManyIntegrationApps } from '../../api-v2';
import { IntegrationAppNameCell } from './IntegrationAppNameCell';

export function IntegrationAppsTable({ integrationProviderId }: { integrationProviderId: number }) {
  const { data: integrationProviderApps } = useGetManyIntegrationApps({
    queryArgs: { integrationProviderId },
  });

  if (!integrationProviderApps) return null;

  return (
    <SbaaTableAllInOne
      data={integrationProviderApps}
      columns={[
        {
          header: 'Name',
          accessorKey: 'applicationName',
          cell: IntegrationAppNameCell,
        },
        {
          header: 'Education Organization',
          accessorKey: 'edorgNames',
          accessorFn: (row) => row.edorgNames.join(', '),
        },
        {
          header: 'ODS',
          accessorKey: 'odsName',
        },
        {
          header: 'Starting Blocks Environment',
          accessorKey: 'sbEnvironmentName',
        },
        {
          header: 'EdFi Tenant',
          accessorKey: 'edfiTenantName',
        },
      ]}
    />
  );
}
