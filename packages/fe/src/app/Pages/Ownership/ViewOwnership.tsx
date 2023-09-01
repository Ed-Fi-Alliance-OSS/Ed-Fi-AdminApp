import { Attribute, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { ownershipQueries } from '../../api';

export const ViewOwnership = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    ownershipId: string;
  };
  const ownership = ownershipQueries.useOne({
    id: params.ownershipId,
    tenantId: params.asId,
  }).data;

  return ownership ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Id" value={ownership.id} />{' '}
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
