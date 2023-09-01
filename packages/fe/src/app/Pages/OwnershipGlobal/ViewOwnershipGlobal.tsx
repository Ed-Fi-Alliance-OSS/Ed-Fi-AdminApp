import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { ownershipQueries, roleQueries, tenantQueries } from '../../api';
import { TenantLink } from '../../routes';
import { RoleGlobalLink } from '../../routes/role-global.routes';

export const ViewOwnershipGlobal = () => {
  const params = useParams() as {
    ownershipId: string;
  };
  const ownership = ownershipQueries.useOne({
    id: params.ownershipId,
  }).data;
  const tenants = tenantQueries.useAll({});
  const roles = roleQueries.useAll({});

  return ownership ? (
    <ContentSection>
      <AttributesGrid>
        <AttributeContainer label="Tenant">
          <TenantLink id={ownership.tenantId} query={tenants} />
        </AttributeContainer>
        <Attribute
          label="Resource"
          value={
            ownership.edorg
              ? ownership.edorg.displayName
              : ownership.ods
              ? ownership.ods.displayName
              : ownership.sbe
              ? ownership.sbe.displayName
              : '-'
          }
        />
        <AttributeContainer label="Role">
          <RoleGlobalLink id={ownership.roleId} query={roles} />
        </AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
