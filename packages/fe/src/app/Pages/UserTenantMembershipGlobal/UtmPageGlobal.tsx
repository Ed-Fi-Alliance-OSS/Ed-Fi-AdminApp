import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router-dom';
import { userTenantMembershipQueries } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditUtmGlobal } from './EditUtmGlobal';
import { ViewUtmGlobal } from './ViewUtmGlobal';
import { useUtmActionsGlobal } from './useUtmActionsGlobal';

export const UtmGlobalPage = () => {
  const params = useParams() as { userTenantMembershipId: string };
  const userTenantMembership = userTenantMembershipQueries.useOne({
    id: params.userTenantMembershipId,
  }).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };
  const actions = useUtmActionsGlobal(userTenantMembership);
  return (
    <PageTemplate
      title={userTenantMembership?.displayName || 'Tenant membership'}
      actions={<PageActions actions={omit(actions, 'View')} />}
      constrainWidth
    >
      {userTenantMembership ? edit ? <EditUtmGlobal /> : <ViewUtmGlobal /> : null}
    </PageTemplate>
  );
};
