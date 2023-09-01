import { Attribute, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { sbeQueries } from '../../api';

export const ViewSbe = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
  };
  const sbe = sbeQueries.useOne({
    id: params.sbeId,
    tenantId: params.asId,
  }).data;

  return sbe ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Environment label" value={sbe.envLabel} />
        <Attribute isCopyable label="Ed-Fi hostname" value={sbe.configPublic?.edfiHostname} />
        <Attribute
          label="Last successful connection to Starting Blocks"
          value={sbe.configPublic?.lastSuccessfulConnectionSbMeta}
          isDate
        />
        <Attribute
          label="Last failed connection to Starting Blocks"
          value={sbe.configPublic?.lastFailedConnectionSbMeta}
          isDate
        />
        <Attribute
          label="Last successful connection to Ed-Fi Admin API"
          value={sbe.configPublic?.lastSuccessfulConnectionAdminApi}
          isDate
        />
        <Attribute
          label="Last failed connection to Ed-Fi Admin API"
          value={sbe.configPublic?.lastFailedConnectionAdminApi}
          isDate
        />
        <Attribute
          label="Last successful sync with Starting Blocks"
          value={sbe.configPublic?.lastSuccessfulPull}
          isDate
        />
        <Attribute
          label="Last failed sync with Starting Blocks"
          value={sbe.configPublic?.lastFailedPull}
          isDate
        />
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
