import { Attribute, PageActions, PageContentPane, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { ErrorBoundary } from 'react-error-boundary';
import { useLocation, useParams } from 'react-router-dom';
import { applicationQueries } from '../../api';

import { Heading, ScaleFade, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useNavContext } from '../../helpers';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditApplication } from './EditApplication';
import { ViewApplication } from './ViewApplication';
import { useSingleApplicationActions } from './useApplicationActions';

export const ApplicationPage = () => {
  const credsLink: unknown = useLocation().state;
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [showUrl, setShowUrl] = useState<boolean>(false);

  useEffect(() => {
    if (typeof credsLink === 'string') {
      try {
        const parsedUrl = new URL(credsLink);
        // clear the state so that the link doesn't show up again on refresh or back nav in the future
        window.history.replaceState({}, '');
        setUrl(parsedUrl.toString());
        // delay for a bit for extra visibility
        setTimeout(() => {
          setShowUrl(true);
        }, 500);
      } catch (error) {
        // leave undefined
      }
    }
  }, [credsLink]);

  return (
    <PageTemplate
      title={
        <ErrorBoundary fallbackRender={() => 'Application'}>
          <ApplicationPageTitle />
        </ErrorBoundary>
      }
      actions={<ApplicationPageActions />}
      customContentBox
    >
      <PageContentPane className="content-card">
        <ApplicationPageContent />
      </PageContentPane>
      {url ? (
        <ScaleFade in={showUrl} unmountOnExit>
          <PageContentPane borderColor="teal.200" bg="teal.50" mt={4}>
            <Heading mb={4} whiteSpace="nowrap" color="gray.700" size="md">
              Key and secret created
            </Heading>
            <Text fontStyle="italic">
              The link below will take you to a page where you can view the credentials. When you go
              there you will be asked to confirm whether you actually want to retrieve them, because
              that can only be done once. If you need to give the link to someone else, make sure
              you don't retrieve the credentials yourself first, or else the link will no longer
              work for them.
            </Text>
            <Text mt={4} fontStyle="italic">
              We limit the retrieval to one time only for security reasons, but note that you can
              always reset the credentials again if there's a mistake.
            </Text>
            <Attribute
              mt={8}
              p={0}
              label="Link to credentials"
              value={url.toString()}
              isCopyable
              isUrl
              isUrlExternal
            />
          </PageContentPane>
        </ScaleFade>
      ) : null}
    </PageTemplate>
  );
};

export const ApplicationPageTitle = () => {
  const navContext = useNavContext();
  const asId = navContext.asId!;
  const sbeId = navContext.sbeId!;

  const params = useParams() as {
    applicationId: string;
  };

  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: sbeId,
    tenantId: asId,
  }).data;

  return <>{application?.displayName || 'Application'}</>;
};

export const ApplicationPageContent = () => {
  const navContext = useNavContext();
  const asId = navContext.asId!;
  const sbeId = navContext.sbeId!;
  const params = useParams() as {
    sbeId: string;
    asId: string;
    applicationId: string;
  };

  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: sbeId,
    tenantId: asId,
  }).data;
  const { edit } = useSearchParamsObject((value) => ({
    edit: 'edit' in value && value.edit === 'true',
  }));

  return application ? (
    edit ? (
      <EditApplication application={application} />
    ) : (
      <ViewApplication />
    )
  ) : null;
};

export const ApplicationPageActions = () => {
  const navContext = useNavContext();
  const asId = navContext.asId!;
  const sbeId = navContext.sbeId!;
  const params = useParams() as {
    sbeId: string;
    asId: string;
    applicationId: string;
  };

  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: sbeId,
    tenantId: asId,
  }).data;

  const actions = useSingleApplicationActions({
    application,
    sbeId: sbeId,
    tenantId: asId,
  });

  return <PageActions actions={omit(actions, 'View')} />;
};
