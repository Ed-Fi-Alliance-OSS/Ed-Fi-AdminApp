import { useMe } from '../../api';
import { PageTemplate } from '../PageTemplate';
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
