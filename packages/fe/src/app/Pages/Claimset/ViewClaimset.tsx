import { Attribute, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { claimsetQueries } from '../../api';

export const ViewClaimset = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    claimsetId: string;
  };
  const claimset = claimsetQueries.useOne({
    id: params.claimsetId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;

  return claimset ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Is reserved" value={claimset.isSystemReserved ?? false} />
        <Attribute label="Applications" value={claimset.applicationsCount} />
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
