import {
  DateFormat,
  PageActions,
  PageTemplate,
  SbaaTableAllInOne,
  ValueAsDate,
} from '@edanalytics/common-ui';
import { useManyIntegrationProvidersGlobalActions } from './useManyIntegrationProvidersGlobalActions';
import { IntegrationProviderNameCell } from './IntegrationProviderNameCell';
import { useGetManyIntegrationProviders } from '../../api-v2';

export const ManyIntegrationProvidersPage = () => {
  const actions = useManyIntegrationProvidersGlobalActions();
  const integrationProviders = useGetManyIntegrationProviders({}).data;

  return (
    <PageTemplate title="Integration Providers" actions={<PageActions actions={actions} />}>
      <SbaaTableAllInOne
        data={integrationProviders ?? []}
        columns={[
          {
            accessorKey: 'name',
            cell: IntegrationProviderNameCell,
            header: 'Name',
          },
          {
            accessorKey: 'description',
            header: 'Description',
          },
          {
            accessorKey: 'createdDate',
            accessorFn: (row) => (row.created ? new Date(row.created) : null),
            cell: ValueAsDate({ default: DateFormat.Full }),
            header: 'Created Date',
          },
        ]}
      />
    </PageTemplate>
  );
};
