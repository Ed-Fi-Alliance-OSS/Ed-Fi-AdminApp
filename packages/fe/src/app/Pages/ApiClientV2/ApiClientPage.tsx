import {
  OneTimeShareCredentials,
  PageContentCard,
  PageTemplate,
} from '@edanalytics/common-ui';
import { ErrorBoundary } from 'react-error-boundary';

export const ApiClientPageV2 = () => {
  return (
    <PageTemplate
      title={
        <ErrorBoundary fallbackRender={() => 'ApiClient'}>
          <></>
        </ErrorBoundary>
      }
      actions={<></>}
      customPageContentCard
    >
      <PageContentCard>
        <> </>
      </PageContentCard>
      <OneTimeShareCredentials />
    </PageTemplate>
  );
};
