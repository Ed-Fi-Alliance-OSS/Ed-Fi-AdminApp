import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import {
  GetApplicationDto,
  GetEdorgDto,
  createEdorgCompositeNaturalKey,
} from '@edanalytics/models';
import { useParams } from 'react-router-dom';
import { claimsetQueries, edorgQueries, sbeQueries, vendorQueries } from '../../api';
import { getEntityFromQuery } from '../../helpers';
import { ClaimsetLink, EdorgLink, VendorLink } from '../../routes';

export const ViewApplication = ({ application }: { application: GetApplicationDto }) => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    applicationId: string;
  };

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
  const edorgsByEdorgId = {
    ...edorgs,
    data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>((map, edorg) => {
      map[
        createEdorgCompositeNaturalKey({
          educationOrganizationId: edorg.educationOrganizationId,
          odsDbName: edorg.odsDbName,
        })
      ] = edorg;
      return map;
    }, {}),
  };

  const edorgByEdorgId = getEntityFromQuery(
    createEdorgCompositeNaturalKey({
      educationOrganizationId: application.educationOrganizationId,
      odsDbName: 'EdFi_Ods_' + application.odsInstanceName,
    }),
    edorgsByEdorgId
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
