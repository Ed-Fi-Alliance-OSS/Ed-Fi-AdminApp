import { FormLabel, Tag, Text, Tooltip } from '@chakra-ui/react';
import { useParams } from '@tanstack/router';
import { roleQueries } from '../../api';
import { roleRoute } from '../../routes';

export const ViewRole = () => {
  const params = useParams({ from: roleRoute.id });
  const role = roleQueries.useOne({
    id: params.roleId,
    tenantId: params.asId,
  }).data;

  return role ? (
    <>
      <FormLabel as="p">Description</FormLabel>
      <Text>{role.description ?? '-'}</Text>
      <FormLabel as="p">Type</FormLabel>
      <Text>{role.type ?? '-'}</Text>
      <FormLabel as="p">Privileges</FormLabel>
      {role.privileges?.map((p) => (
        <Tooltip label={p.name}>
          <Tag colorScheme="orange" display="flex" w="max-content" mb={2}>
            {p.code}
          </Tag>
        </Tooltip>
      ))}
    </>
  ) : null;
};
