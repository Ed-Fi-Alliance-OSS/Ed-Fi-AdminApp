import { ContentSection, PageContentCard, PageTemplate } from '@edanalytics/common-ui';
import { AuthorizeComponent, useTeamNavContext } from '../../helpers';
import { SbEnvironmentsTable } from '../SbEnvironment/SbEnvironmentsPage';

export const TeamHome = () => {
  const { teamId } = useTeamNavContext();
  return (
    <PageTemplate customPageContentCard title="Home">
      <AuthorizeComponent
        config={{
          privilege: 'team.sb-environment:read',
          subject: { teamId, id: '__filtered__' },
        }}
      >
        <PageContentCard>
          <ContentSection heading="Environments">
            <SbEnvironmentsTable />
          </ContentSection>
        </PageContentCard>
      </AuthorizeComponent>
    </PageTemplate>
  );
};
