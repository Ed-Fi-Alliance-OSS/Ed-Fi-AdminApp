import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router-dom';
import { sbeQueries } from '../../api';
import { ViewSbe } from './ViewSbe';

export const SbePage = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
  };
  const sbe = sbeQueries.useOne({
    id: params.sbeId,
    tenantId: params.asId,
  }).data;

  const actions = {};

  return (
    <PageTemplate
      constrainWidth
      title={sbe?.displayName || 'Sbe'}
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      {sbe ? <ViewSbe /> : null}
    </PageTemplate>
  );
};
