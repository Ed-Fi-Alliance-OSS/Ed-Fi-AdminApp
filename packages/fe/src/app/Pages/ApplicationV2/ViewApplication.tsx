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
  GetIntegrationAppDto,
  GetOdsDto,
  edorgKeyV2,
} from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import {
  claimsetQueriesV2,
  edorgQueries,
  odsQueries,
  profileQueriesV2,
  vendorQueriesV2,
} from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { ClaimsetLinkV2, EdorgLink, OdsLink, ProfileLink, VendorLinkV2 } from '../../routes';

export const ViewApplication = ({
  application,
}: {
  application: GetApplicationDtoV2 & GetIntegrationAppDto;
}) => {
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
  const profiles = useQuery(
    profileQueriesV2.getAll({
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
        edfiTenant?.sbEnvironment.startingBlocks,
        edfiTenant?.sbEnvironment.domain,
        application.applicationName,
        edfiTenant.name
      )
    : undefined;

  return application ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute isCopyable label="Application name" value={application.applicationName} />
        <AttributeContainer label="ODS">
          {application.odsInstanceIds
            .map((odsInstanceId) => (
              <OdsLink key={odsInstanceId} id={odsInstanceId} query={odssByInstanceId} />
            ))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .reduce((prev, curr) => [prev, ', ', curr] as any)}
        </AttributeContainer>{' '}
        <AttributeContainer label="Vendor">
          <VendorLinkV2 id={application.vendorId} query={vendors} />
        </AttributeContainer>
        <AttributeContainer label="Profiles">
          {application.profileIds?.length ? (
            <UnorderedList>
              {application.profileIds.map((profileId) => (
                <ListItem key={profileId}>
                  <ProfileLink key={profileId} id={profileId} query={profiles} />
                </ListItem>
              ))}
            </UnorderedList>
          ) : (
            '-'
          )}{' '}
        </AttributeContainer>
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
        <Attribute label="Integration Provider" value={application.integrationProviderName} />
        <Attribute label="URL" value={url} isUrl isUrlExternal isCopyable />
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
