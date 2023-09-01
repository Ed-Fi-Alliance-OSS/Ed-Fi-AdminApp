import { ActionBarActions, PageTemplate } from '@edanalytics/common-ui';
import _ from 'lodash';
import { useParams } from 'react-router-dom';
import { userQueries } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditUserGlobal } from './EditUserGlobal';
import { ViewUserGlobal } from './ViewUserGlobal';
import { useUserGlobalActions } from './useUserGlobalActions';

export const UserGlobalPage = () => {
  const params = useParams() as {
    userId: string;
  };
  const user = userQueries.useOne({
    id: params.userId,
  }).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };
  const actions = useUserGlobalActions(user);

  return (
    <PageTemplate
      constrainWidth
      title={user?.displayName || 'User'}
      actions={<ActionBarActions actions={_.omit(actions, 'View')} />}
    >
      {user ? edit ? <EditUserGlobal user={user} /> : <ViewUserGlobal /> : null}
    </PageTemplate>
  );
};
