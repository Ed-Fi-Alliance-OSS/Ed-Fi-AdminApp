import { useParams } from 'react-router-dom';
import { GetIntegrationProviderDto } from '@edanalytics/models';
import { useGetOneIntegrationProvider } from '../../api-v2';

export const IntegrationProviderBreadcrumb = () => {
  const { integrationProviderId: id } = useParams() as { integrationProviderId: string };
  const integrationProvider = useGetOneIntegrationProvider({ queryArgs: { id } }).data;
  return integrationProvider?.name ?? id;
};
