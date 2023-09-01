import { Grid, Tag } from '@chakra-ui/react';
import { Attribute, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { GetRoleDto } from '@edanalytics/models';

export const ViewRole = (props: { role: GetRoleDto }) => {
  const { role } = props;
  return (
    <>
      <ContentSection>
        <AttributesGrid>
          <Attribute label="Description" value={role.description} />
          <Attribute label="Type" value={role.type} />{' '}
        </AttributesGrid>
      </ContentSection>
      <ContentSection heading="Privileges">
        <Grid gap={2} templateColumns="repeat(4, auto)" w="fit-content">
          {role.privileges?.map((p) => (
            <Tag key={p.code} colorScheme="orange" display="flex" w="max-content">
              {p.code}
            </Tag>
          ))}
        </Grid>
      </ContentSection>
    </>
  );
};
