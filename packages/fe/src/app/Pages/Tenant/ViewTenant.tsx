import { Attribute, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { tenantQueries } from '../../api';

export const ViewTenant = () => {
  const params = useParams() as { tenantId: string };
  const tenant = tenantQueries.useOne({
    id: params.tenantId,
  }).data;

  return tenant ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Name" value={tenant.name} />{' '}
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
