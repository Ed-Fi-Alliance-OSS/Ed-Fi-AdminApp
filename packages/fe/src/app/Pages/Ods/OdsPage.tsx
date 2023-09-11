import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router-dom';
import { odsQueries } from '../../api';
import { ViewOds } from './ViewOds';

export const OdsPage = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    odsId: string;
  };
  const ods = odsQueries.useOne({
    id: params.odsId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;

  const actions = {};
  return (
    <PageTemplate
      title={ods?.displayName || 'Ods'}
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      {ods ? <ViewOds /> : null}
    </PageTemplate>
  );
};
