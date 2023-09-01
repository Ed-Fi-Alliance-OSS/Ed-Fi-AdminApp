import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { GetApplicationDto } from '@edanalytics/models';
import { useParams } from 'react-router-dom';
import {
  applicationQueries,
  claimsetQueries,
  edorgQueries,
  sbeQueries,
  vendorQueries,
} from '../../api';
import { ClaimsetLink, EdorgLink, VendorLink } from '../../routes';

export const ViewApplication = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    applicationId: string;
  };
  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;

  const sbe = sbeQueries.useOne({
    tenantId: params.asId,
    id: params.sbeId,
  });

  const edorgs = edorgQueries.useAll({
    tenantId: params.asId,
    sbeId: params.sbeId,
  });
  const vendors = vendorQueries.useAll({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const claimsets = claimsetQueries.useAll({
    tenantId: params.asId,
    sbeId: params.sbeId,
  });

  const edorgByEdorgId = Object.values(edorgs.data ?? {}).find(
    (e) =>
      e.educationOrganizationId === application?.educationOrganizationId &&
      (application?.odsInstanceName === null ||
        e.odsDbName === 'EdFi_Ods_' + application?.odsInstanceName)
  );
  const claimsetByName = Object.values(claimsets.data ?? {}).find(
    (e) => e.name === application?.claimSetName
  );

  const url =
    application && edorgByEdorgId && sbe.data?.configPublic?.edfiHostname
      ? GetApplicationDto.apiUrl(
          edorgByEdorgId,
          sbe.data?.configPublic?.edfiHostname,
          application.applicationName
        )
      : undefined;

  return application ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute isCopyable label="Application name" value={application.displayName} />
        <AttributeContainer label="Ed-org">
          <EdorgLink id={edorgByEdorgId?.id} query={edorgs} />
        </AttributeContainer>
        <AttributeContainer label="Vendor">
          <VendorLink id={application?.vendorId} query={vendors} />
        </AttributeContainer>
        <AttributeContainer label="Claimset">
          <ClaimsetLink id={claimsetByName?.id} query={claimsets} />
        </AttributeContainer>
        <Attribute label="URL" value={url} isUrl isUrlExternal isCopyable />
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
