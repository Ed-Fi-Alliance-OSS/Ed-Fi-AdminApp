import { UnorderedList, ListItem, Tag } from '@chakra-ui/react';
import { Attribute, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { GetRoleDto } from '@edanalytics/models';
import { PrivilegeNest, nestPrivileges } from '../RoleGlobal/nest-privileges';

export const ViewRole = (props: { role: GetRoleDto }) => {
  const { role } = props;
  const nestedPrivileges = role.privileges ? nestPrivileges(role.privileges ?? []) : undefined;
  return (
    <>
      <ContentSection>
        <AttributesGrid>
          <Attribute label="Description" value={role.description} />
          <Attribute label="Type" value={role.type} />
        </AttributesGrid>
      </ContentSection>
      <ContentSection heading="Privileges">
        {nestedPrivileges ? (
          <UnorderedList>
            {Object.entries(nestedPrivileges).map(([heading, childs]) => (
              <ViewPrivilegeGroup key={heading} heading={heading} childs={childs} />
            ))}
          </UnorderedList>
        ) : null}
      </ContentSection>
    </>
  );
};
const ViewPrivilegeGroup = (props: { heading: string; childs: PrivilegeNest | undefined }) => {
  const allChilds = Object.entries(props.childs ?? {});
  const { leafChilds, branchChilds } = allChilds.reduce(
    (acc, [k, v]) => {
      if (v && Object.entries(v).length) {
        acc.branchChilds.push([k, v]);
      } else {
        acc.leafChilds.push(k);
      }
      return acc;
    },
    { leafChilds: [] as string[], branchChilds: [] as [string, PrivilegeNest][] }
  );
  return (
    <ListItem my={1}>
      {props.heading}
      {leafChilds.map((p) => (
        <Tag key={p} ml={2} colorScheme="orange" display="inline-flex" w="max-content">
          {p.split(':')[1]}
        </Tag>
      ))}
      {branchChilds.length ? (
        <UnorderedList>
          {branchChilds.map(([heading, childs]) => (
            <ViewPrivilegeGroup key={heading} heading={heading} childs={childs} />
          ))}
        </UnorderedList>
      ) : null}
    </ListItem>
  );
};
