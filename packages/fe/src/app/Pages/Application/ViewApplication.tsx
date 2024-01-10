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

  const claimsetsByName = {
    data: Object.fromEntries(Object.values(claimsets.data ?? {}).map((c) => [c.name, c])),
  };

  const url =
    application && sbe.data?.configPublic?.edfiHostname
      ? GetApplicationDto.apiUrl(sbe.data?.configPublic?.edfiHostname, application.applicationName)
      : undefined;

  return application ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute isCopyable label="Application name" value={application.displayName} />
        <AttributeContainer label="Vendor">
          <VendorLink id={application?.vendorId} query={vendors} />
        </AttributeContainer>
        <AttributeContainer label="Claimset">
          <ClaimsetLink id={application.claimSetName} query={claimsetsByName} />
        </AttributeContainer>
        <Attribute label="URL" value={url} isUrl isUrlExternal isCopyable />
        <AttributeContainer label="Ed-org">
          {application._educationOrganizationIds?.length
            ? application._educationOrganizationIds.map((edorgId) => (
                <p key={edorgId}>
                  <EdorgLink
                    id={createEdorgCompositeNaturalKey({
                      educationOrganizationId: edorgId,
                      odsDbName: 'EdFi_Ods_' + application.odsInstanceName,
                    })}
                    query={edorgsByEdorgId}
                  />
                </p>
              ))
            : '-'}
        </AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
