import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { ownershipQueries, roleQueries, sbeQueries, tenantQueries } from '../../api';
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
  const sbes = sbeQueries.useAll({});

  const getSbeDisplayName = (sbeId: number) => {
    if (sbes.isSuccess && sbes.data) {
      return `(${sbes.data?.[sbeId]?.displayName ?? 'Environment not found'})`;
    } else {
      return '(loading environment...)';
    }
  };

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
              ? `${ownership.edorg.displayName} ${getSbeDisplayName(ownership.edorg.sbeId)}`
              : ownership.ods
              ? `${ownership.ods.displayName} ${getSbeDisplayName(ownership.ods.sbeId)}`
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
