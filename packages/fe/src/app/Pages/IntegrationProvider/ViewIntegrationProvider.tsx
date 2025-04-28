import { Attribute, AttributesGrid, ContentSection, PageContentCard } from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { useGetOneIntegrationProvider } from '../../api-v2';
import { GetIntegrationProviderDto } from '@edanalytics/models';

export const ViewIntegrationProvider = () => {
  const { integrationProviderId: id } = useParams() as { integrationProviderId: string };

  const integrationProvider = useGetOneIntegrationProvider({ queryArgs: { id } }).data;

  return (
    <PageContentCard>
      <ContentSection>
        <AttributesGrid>
          <Attribute label="Name" value={integrationProvider?.name} />
          <Attribute label="Description" value={integrationProvider?.description} />
        </AttributesGrid>
      </ContentSection>
    </PageContentCard>
  );
};
