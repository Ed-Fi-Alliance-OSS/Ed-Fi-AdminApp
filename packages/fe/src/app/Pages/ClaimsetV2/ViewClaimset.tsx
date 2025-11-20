import { Tooltip } from '@chakra-ui/react';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
  ResourceClaimsTableV2,
} from '@edanalytics/common-ui';
import { GetClaimsetSingleDtoV2 } from '@edanalytics/models';

const ViewClaimset = ({ claimset }: { claimset: GetClaimsetSingleDtoV2 }) => {
  return claimset ? (
    <>
      <ContentSection>
        <AttributesGrid>
          <AttributeContainer label="Is system-reserved">
            <Tooltip
              hasArrow
              label="System-reserved claimsets cannot be used to create applications."
            >
              <span>{String(!!claimset._isSystemReserved)}</span>
            </Tooltip>
          </AttributeContainer>
          <Attribute label="Applications" value={claimset._applications.length} />
        </AttributesGrid>
      </ContentSection>
      <ContentSection heading="Resource claims">
        <ResourceClaimsTableV2 claimset={claimset} />
      </ContentSection>
    </>
  ) : null;
};

export default ViewClaimset;
