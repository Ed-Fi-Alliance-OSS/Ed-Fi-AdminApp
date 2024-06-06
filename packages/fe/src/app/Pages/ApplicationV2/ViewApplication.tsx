import { ListItem, UnorderedList } from '@chakra-ui/react';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import {
  GetApplicationDtoV2,
  GetClaimsetMultipleDtoV2,
  GetEdorgDto,
  GetOdsDto,
  edorgKeyV2,
} from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { claimsetQueriesV2, edorgQueries, odsQueries, vendorQueriesV2 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { ClaimsetLinkV2, EdorgLink, OdsLink, VendorLinkV2 } from '../../routes';

export const ViewApplication = ({ application }: { application: GetApplicationDtoV2 }) => {
  const { edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();

  const vendors = useQuery(
    vendorQueriesV2.getAll({
      edfiTenant,
      teamId,
    })
  );
  const claimsets = useQuery(
    claimsetQueriesV2.getAll({
      edfiTenant,
      teamId,
    })
  );

  const edorgs = useQuery(
    edorgQueries.getAll({
      teamId,
      edfiTenant,
    })
  );

  const edorgsByEdorgId = {
    ...edorgs,
    data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>((map, edorg) => {
      map[
        edorgKeyV2({
          edorg: edorg.educationOrganizationId,
          ods: edorg.odsInstanceId,
        })
      ] = edorg;
      return map;
    }, {}),
  };
  const claimsetsByName = {
    ...claimsets,
    data: Object.values(claimsets.data ?? {}).reduce<Record<string, GetClaimsetMultipleDtoV2>>(
      (map, claimset) => {
        map[claimset.name] = claimset;
        return map;
      },
      {}
    ),
  };

  const odss = useQuery(
    odsQueries.getAll({
      edfiTenant: edfiTenant,
      teamId,
    })
  );
  const odssByInstanceId = {
    ...odss,
    data: Object.values(odss.data ?? {}).reduce<Record<string, GetOdsDto>>((map, ods) => {
      map[ods.odsInstanceId!] = ods;
      return map;
    }, {}),
  };

  const url = edfiTenant?.sbEnvironment.domain
    ? GetApplicationDtoV2.apiUrl(
        edfiTenant?.sbEnvironment.domain,
        application.applicationName,
        edfiTenant.name
      )
    : undefined;

  return application ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute isCopyable label="Application name" value={application.displayName} />
        <AttributeContainer label="ODS">
          {application.odsInstanceIds
            .map((odsInstanceId) => (
              <OdsLink key={odsInstanceId} id={odsInstanceId} query={odssByInstanceId} />
            ))
            .reduce((prev, curr) => [prev, ', ', curr] as any)}
        </AttributeContainer>{' '}
        <AttributeContainer label="Vendor">
          <VendorLinkV2 id={application.vendorId} query={vendors} />
        </AttributeContainer>
        <Attribute
          label="Profile IDs"
          value={application.profileIds ? application.profileIds.join(', ') : undefined}
        />
        <AttributeContainer label="Claimset">
          <ClaimsetLinkV2 id={application.claimSetName} query={claimsetsByName} />
        </AttributeContainer>
        <AttributeContainer label="Ed-org">
          {application.educationOrganizationIds?.length ? (
            <UnorderedList>
              {application.odsInstanceIds.flatMap((odsInstanceId) =>
                application.educationOrganizationIds.map((edorgId) => (
                  <ListItem key={edorgId}>
                    <EdorgLink
                      key={edorgId}
                      id={edorgKeyV2({
                        edorg: edorgId,
                        ods: odsInstanceId,
                      })}
                      query={edorgsByEdorgId}
                    />
                  </ListItem>
                ))
              )}
            </UnorderedList>
          ) : (
            '-'
          )}
        </AttributeContainer>
        <Attribute label="URL" value={url} isUrl isUrlExternal isCopyable />
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
