import { FormLabel, Tag, Text } from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { roleQueries, userQueries } from '../../api';
import { RoleGlobalLink } from '../../routes/role-global.routes';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';

export const ViewUserGlobal = () => {
  const params = useParams() as {
    userId: string;
  };
  const user = userQueries.useOne({
    id: params.userId,
  }).data;
  const roles = roleQueries.useAll({});

  return user ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Given Name" value={user.givenName} />
        <Attribute label="Family Name" value={user.familyName} />
        <Attribute isCopyable label="Username" value={user.username} />
        <AttributeContainer label="Status">
          {user.isActive ? (
            <Tag colorScheme="green">Active</Tag>
          ) : (
            <Tag colorScheme="orange">Inactive</Tag>
          )}
        </AttributeContainer>
        <AttributeContainer label="Role">
          <RoleGlobalLink id={user.roleId} query={roles} />
        </AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
