import { PageTemplate } from '@edanalytics/common-ui';
import { useMe } from '../../api';
import { ViewAccount } from './ViewAccount';

export const AccountPage = () => {
  const me = useMe();
  const user = me.data;

  return (
    <PageTemplate constrainWidth title={user?.displayName || 'User'}>
      {user ? <ViewAccount /> : null}
    </PageTemplate>
  );
};
