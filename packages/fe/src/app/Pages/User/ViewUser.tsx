import { Attribute, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { userQueries } from '../../api';

export const ViewUser = () => {
  const params = useParams() as {
    asId: string;
    userId: string;
  };
  const user = userQueries.useOne({
    id: params.userId,
    tenantId: params.asId,
  }).data;

  return user ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Given Name" value={user.givenName} />
        <Attribute label="Family Name" value={user.familyName} />
        <Attribute isCopyable label="Username" value={user.username} />
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
