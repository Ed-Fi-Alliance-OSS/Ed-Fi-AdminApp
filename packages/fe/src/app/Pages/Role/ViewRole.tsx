import { FormLabel, Grid, Tag, Text } from '@chakra-ui/react';
import { GetRoleDto } from '@edanalytics/models';

export const ViewRole = (props: { role: GetRoleDto }) => {
  const { role } = props;
  return (
    <>
      <FormLabel as="p">Description</FormLabel>
      <Text>{role.description ?? '-'}</Text>
      <FormLabel as="p">Type</FormLabel>
      <Text>{role.type ?? '-'}</Text>
      <FormLabel as="p">Privileges</FormLabel>
      <Grid gap={2} templateColumns="repeat(4, auto)" w="fit-content">
        {role.privileges?.map((p) => (
          <Tag key={p.code} colorScheme="orange" display="flex" w="max-content">
            {p.code}
          </Tag>
        ))}
      </Grid>
    </>
  );
};
