import {
  ContentSection,
  PageActions,
  PageContentCard,
  PageSectionActions,
  PageTemplate,
} from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router-dom';
import {
  AuthorizeComponent,
  useTeamEdfiTenantNavContextLoaded,
  VersioningHoc,
} from '../../helpers';
import { useEdorgsActions } from '../Edorg/useEdorgsActions';
import { sampleOdsData } from './odsData';
import { OdsEdorgsTable } from './OdsEdorgsTable';
import { OdsRowCountsTable } from './OdsRowCountsTable';
import { ViewOds } from './ViewOds';
import { useOdsActions } from './useOdsActions';
import { useSyncEdOrgsAction } from './useSyncEdOrgsAction';

export const OdsPage = () => {
  const params = useParams() as {
    odsId: string;
  };
  const { edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();
  const ods = sampleOdsData.find((row) => row.id === Number(params.odsId));

  const actions = useOdsActions({ id: Number(params.odsId) });
  const edorgsActions = useEdorgsActions({ ods: undefined });
  const syncEdOrgsActions = useSyncEdOrgsAction();
  return (
    <PageTemplate
      title={ods?.name || 'Ods'}
      actions={<PageActions actions={omit(actions, 'View')} />}
      customPageContentCard
    >
      {ods ? (
        <>
          <PageContentCard>
            <ViewOds ods={ods} />
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
              <PageSectionActions actions={{ ...edorgsActions, ...syncEdOrgsActions }} />
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
