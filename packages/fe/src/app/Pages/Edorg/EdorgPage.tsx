import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router-dom';
import { edorgQueries } from '../../api';
import { ViewEdorg } from './ViewEdorg';

export const EdorgPage = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    edorgId: string;
  };
  const edorg = edorgQueries.useOne({
    id: params.edorgId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;
  const actions = {};

  return (
    <PageTemplate
      constrainWidth
      title={edorg?.displayName || 'Edorg'}
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      {edorg ? <ViewEdorg /> : null}
    </PageTemplate>
  );
};
