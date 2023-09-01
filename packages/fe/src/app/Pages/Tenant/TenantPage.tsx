import { ActionBarActions, PageTemplate } from '@edanalytics/common-ui';
import _ from 'lodash';
import { useParams } from 'react-router-dom';
import { tenantQueries } from '../../api';

import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditTenant } from './EditTenant';
import { ViewTenant } from './ViewTenant';
import { useTenantActions } from './useTenantActions';

export const TenantPage = () => {
  const params = useParams() as { tenantId: string };
  const tenant = tenantQueries.useOne({
    id: params.tenantId,
  }).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };
  const actions = useTenantActions(tenant);
  return (
    <PageTemplate
      title={tenant?.displayName || 'Tenant'}
      actions={<ActionBarActions actions={_.omit(actions, 'View')} />}
      constrainWidth
    >
      {tenant ? edit ? <EditTenant /> : <ViewTenant /> : null}
    </PageTemplate>
  );
};
