import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { Badge } from '@chakra-ui/react';
import {
  GetApiClientDtoV2,
  GetOdsDto,
} from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import {
  odsQueries,
} from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { OdsLink } from '../../routes';

interface ViewApiClientProps {
  apiClient: GetApiClientDtoV2;
}

export const ViewApiClient = ({ apiClient }: ViewApiClientProps) => {
  const { edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();

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

  return apiClient ? (
    <ContentSection>
      <AttributesGrid>
        <Attribute isCopyable label="Name" value={apiClient.name} />
        <AttributeContainer label="ODS">
          {apiClient.odsInstanceIds
            .map((odsInstanceId) => (
              <OdsLink key={odsInstanceId} id={odsInstanceId} query={odssByInstanceId} />
            ))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .reduce((prev, curr) => [prev, ', ', curr] as any)}
        </AttributeContainer>{' '}
        <AttributeContainer label="Client id" >
          {apiClient.key}
        </AttributeContainer>
        <AttributeContainer label="Enabled" >
          <Badge colorScheme={apiClient.isApproved ? 'green' : 'red'}>
            {apiClient.isApproved ? 'Enabled' : 'Disabled'}
          </Badge>
        </AttributeContainer>
        <AttributeContainer label="Status" >
          {apiClient.keyStatus}
        </AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  ) : null;
};