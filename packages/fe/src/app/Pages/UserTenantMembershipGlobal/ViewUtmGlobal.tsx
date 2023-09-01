import { AttributeContainer, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { roleQueries, tenantQueries, userTenantMembershipQueries } from '../../api';
import { TenantLink, UserGlobalLink } from '../../routes';
import { RoleGlobalLink } from '../../routes/role-global.routes';

export const ViewUtmGlobal = () => {
  const params = useParams() as { userTenantMembershipId: string };
  const userTenantMembership = userTenantMembershipQueries.useOne({
    id: params.userTenantMembershipId,
  }).data;
  const tenants = tenantQueries.useAll({});
  const roles = roleQueries.useAll({});

  return userTenantMembership ? (
    <ContentSection>
      <AttributesGrid>
        <AttributeContainer label="Tenant">
          <TenantLink query={tenants} id={userTenantMembership.tenantId} />
        </AttributeContainer>
        <AttributeContainer label="User">
          <UserGlobalLink id={userTenantMembership.userId} />
        </AttributeContainer>
        <AttributeContainer label="Role">
          {userTenantMembership.roleId === null ? (
            <>&nbsp;-&nbsp;</>
          ) : (
            <RoleGlobalLink query={roles} id={userTenantMembership.roleId} />
          )}
        </AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
