import { Badge } from '@chakra-ui/react';
import { AttributeContainer, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { OdsSampleRow, odsStatusDisplayMap } from './odsData';

export const ViewOds = ({ ods }: { ods: OdsSampleRow }) => {
  const { label, colorScheme } = odsStatusDisplayMap[ods.status];
  return (
    <ContentSection>
      <AttributesGrid>
        <AttributeContainer label="Name">{ods.name}</AttributeContainer>
        <AttributeContainer label="Type">{ods.type}</AttributeContainer>
        <AttributeContainer label="Status">
          <Badge colorScheme={colorScheme}>{label}</Badge>
        </AttributeContainer>
        <AttributeContainer label="Database Name">{ods.databaseName}</AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  );
};
