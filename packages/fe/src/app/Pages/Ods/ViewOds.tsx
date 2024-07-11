import { AttributeContainer, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { edfiTenantQueries, odsQueries } from '../../api';
import { queryFromEntity } from '../../api/queries/builder';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { EdfiTenantLink, SbEnvironmentLink } from '../../routes';
import { OdsRowCountsTable } from './OdsRowCountsTable';

export const ViewOds = () => {
  const params = useParams() as {
    odsId: string;
  };
  const { teamId, edfiTenant, sbEnvironmentId, sbEnvironment } =
    useTeamEdfiTenantNavContextLoaded();
  const ods = useQuery(
    odsQueries.getOne({
      id: params.odsId,
      edfiTenant,
      teamId,
    })
  ).data;
  const edfiTenants = useQuery(
    edfiTenantQueries.getAll({
      teamId,
      sbEnvironmentId,
    })
  );

  return ods ? (
    <ContentSection>
      <AttributesGrid>
        <AttributeContainer label="Environment">
          <SbEnvironmentLink id={ods.sbEnvironmentId} query={queryFromEntity(sbEnvironment)} />
        </AttributeContainer>
        <AttributeContainer label="Tenant">
          <EdfiTenantLink id={ods.edfiTenantId} query={edfiTenants} />
        </AttributeContainer>
      </AttributesGrid>
    </ContentSection>
  ) : null;
};
