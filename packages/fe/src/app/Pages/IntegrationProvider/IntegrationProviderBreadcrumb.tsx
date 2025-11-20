import { useParams } from 'react-router-dom';
import { useGetOneIntegrationProvider } from '../../api-v2';

export const IntegrationProviderBreadcrumb = () => {
  const { integrationProviderId } = useParams() as { integrationProviderId: string };
  const integrationProvider = useGetOneIntegrationProvider({
    queryArgs: { integrationProviderId },
  }).data;
  return integrationProvider?.name ?? integrationProviderId;
};
