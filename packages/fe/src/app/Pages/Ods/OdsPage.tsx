import {
  ContentSection,
  PageActions,
  PageContentCard,
  PageSectionActions,
  PageTemplate,
} from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import omit from 'lodash/omit';
import { useParams } from 'react-router-dom';
import { odsQueries } from '../../api';
import {
  AuthorizeComponent,
  useTeamEdfiTenantNavContextLoaded,
  VersioningHoc,
} from '../../helpers';
import { useEdorgsActions } from '../Edorg/useEdorgsActions';
import { OdsEdorgsTable } from './OdsEdorgsTable';
import { ViewOds } from './ViewOds';
import { useOdsActions } from './useOdsActions';
import { OdsRowCountsTable } from './OdsRowCountsTable';

export const OdsPage = () => {
  const params = useParams() as {
    odsId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const ods = useQuery(
    odsQueries.getOne({
      id: params.odsId,
      edfiTenant,
      teamId,
    })
  ).data;

  const actions = useOdsActions({ id: Number(params.odsId) });
  const edorgsActions = useEdorgsActions({ ods });
  return (
    <PageTemplate
      title={ods?.displayName || 'Ods'}
      actions={<PageActions actions={omit(actions, 'View')} />}
      customPageContentCard
    >
      {ods ? (
        <>
          <PageContentCard>
            <ViewOds />
          </PageContentCard>
          <AuthorizeComponent
            config={{
              privilege: 'team.sb-environment.edfi-tenant.ods.edorg:read',
              subject: {
                id: '__filtered__',
                edfiTenantId: edfiTenant.id,
                teamId,
              },
            }}
          >
            <PageContentCard>
              <PageSectionActions actions={edorgsActions} />
              <ContentSection heading="Ed-Orgs">
                <OdsEdorgsTable />
              </ContentSection>
            </PageContentCard>
          </AuthorizeComponent>
          <VersioningHoc
            v2={
              <AuthorizeComponent
                config={{
                  privilege: 'team.sb-environment.edfi-tenant.ods:read-row-counts',
                  subject: {
                    id: params.odsId,
                    edfiTenantId: edfiTenant.id,
                    teamId,
                  },
                }}
              >
                <PageContentCard>
                  <ContentSection heading="ODS Row Counts">
                    <OdsRowCountsTable />
                  </ContentSection>
                </PageContentCard>
              </AuthorizeComponent>
            }
          />
        </>
      ) : null}
    </PageTemplate>
  );
};
