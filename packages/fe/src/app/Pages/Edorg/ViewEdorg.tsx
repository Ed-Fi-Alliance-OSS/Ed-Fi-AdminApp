import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { edorgQueries, odsQueries, sbeQueries } from '../../api';
import { EdorgLink, OdsLink, SbeLink } from '../../routes';

export const ViewEdorg = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    edorgId: string;
  };
  const edorg = edorgQueries.useOne({
    id: params.edorgId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;
  const edorgs = edorgQueries.useAll({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const odss = odsQueries.useAll({ tenantId: params.asId, sbeId: params.sbeId, optional: true });
  const sbes = sbeQueries.useAll({
    tenantId: params.asId,
  });

  return edorg ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute isCopyable label="Type" value={edorg.discriminator} />
        {edorg.parentId ? (
          <AttributeContainer label="Parent">
            <EdorgLink id={edorg.parentId} query={edorgs} />
          </AttributeContainer>
        ) : null}
        <AttributeContainer label="ODS">
          <OdsLink id={edorg.odsId} query={odss} />
        </AttributeContainer>
        <AttributeContainer label="Environment">
          <SbeLink id={edorg.sbeId} query={sbes} />
        </AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
