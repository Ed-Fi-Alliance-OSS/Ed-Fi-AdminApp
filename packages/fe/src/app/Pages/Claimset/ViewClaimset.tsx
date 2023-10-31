import { Badge, BadgeProps, Flex, StyleProps, Tooltip } from '@chakra-ui/react';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
  ResourceClaimsTable,
  SbaaTableAllInOne,
} from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { claimsetQueries } from '../../api';
import { GetClaimsetDto, ResourceClaimDto } from '@edanalytics/models';

const ViewClaimset = () => {
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
    <>
      <ContentSection
        css={{
          '& div.react-json-view': {
            background: 'transparent!important',
          },
        }}
      >
        <AttributesGrid>
          <AttributeContainer label="Is system-reserved">
            <Tooltip
              hasArrow
              label="System-reserved claimsets cannot be used to create applications."
            >
              <span>{String(!!claimset.isSystemReserved)}</span>
            </Tooltip>
          </AttributeContainer>
          <Attribute label="Applications" value={claimset.applicationsCount} />
        </AttributesGrid>
      </ContentSection>
      <ContentSection heading="Resource claims">
        <ResourceClaimsTable claimset={claimset} />
      </ContentSection>
    </>
  ) : null;
};

export default ViewClaimset;
