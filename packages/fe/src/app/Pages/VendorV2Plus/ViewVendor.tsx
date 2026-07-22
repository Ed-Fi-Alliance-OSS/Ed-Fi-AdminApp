import { useQuery } from '@tanstack/react-query';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
  CopyButton,
} from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { vendorQueriesV2 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

export const ViewVendor = () => {
  const params = useParams() as {
    vendorId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const vendor = useQuery(
    vendorQueriesV2.getOne({
      teamId,
      id: params.vendorId,
      edfiTenant,
    })
  ).data;

  return vendor ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Id" value={vendor.id} isCopyable />
        <Attribute label="Company" value={vendor.company} />
        <Attribute label="Contact" value={vendor.contactName} />
        {vendor.contactEmailAddress ? (
          <Attribute
            label="Contact email"
            value={`mailto:${vendor.contactEmailAddress}`}
            isUrl
            isUrlExternal
          />
        ) : null}
        <AttributeContainer label="Namespace">
          {vendor.namespacePrefixes === ''
            ? '-'
            : vendor.namespacePrefixes.split(/,\s*/g).map((ns) => (
                <div key={ns}>
                  <CopyButton value={ns} />
                  {ns}
                </div>
              ))}
        </AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
