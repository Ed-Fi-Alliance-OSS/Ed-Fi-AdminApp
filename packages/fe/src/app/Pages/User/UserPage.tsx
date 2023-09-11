import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router-dom';
import { userQueries } from '../../api';

import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditUser } from './EditUser';
import { ViewUser } from './ViewUser';

export const UserPage = () => {
  const params = useParams() as {
    asId: string;
    userId: string;
  };
  const user = userQueries.useOne({
    id: params.userId,
    tenantId: params.asId,
  }).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };

  const actions = {};

  return (
    <PageTemplate
      constrainWidth
      title={user?.displayName || 'User'}
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      {user ? edit ? <EditUser /> : <ViewUser /> : null}
    </PageTemplate>
  );
};
