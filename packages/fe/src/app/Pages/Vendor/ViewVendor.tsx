import { Attribute, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { vendorQueries } from '../../api';

export const ViewVendor = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    vendorId: string;
  };
  const vendor = vendorQueries.useOne({
    id: params.vendorId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;

  return vendor ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute label="Company" value={vendor.company} />
        <Attribute
          label="Namespace"
          value={vendor.namespacePrefixes === '' ? '-' : vendor.namespacePrefixes}
        />
        <Attribute label="Contact" value={vendor.contactName} />
        {vendor.contactEmailAddress ? (
          <Attribute
            label="Contact email"
            value={`mailto:${vendor.contactEmailAddress}`}
            isUrl
            isUrlExternal
          />
        ) : null}
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
