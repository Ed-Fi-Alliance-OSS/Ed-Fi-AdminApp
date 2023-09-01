import { ActionBarActions, PageTemplate } from '@edanalytics/common-ui';
import _ from 'lodash';
import { useParams } from 'react-router-dom';
import { roleQueries } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { ViewRole } from '../Role/ViewRole';
import { EditRoleGlobal } from './EditRoleGlobal';
import { useRoleGlobalActions } from './useRoleGlobalActions';

export const RoleGlobalPage = () => {
  const params = useParams() as {
    roleId: string;
  };
  const role = roleQueries.useOne({
    id: params.roleId,
  }).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };
  const actions = useRoleGlobalActions(role);

  return (
    <PageTemplate
      constrainWidth
      title={role?.displayName || 'Role'}
      actions={<ActionBarActions actions={_.omit(actions, 'View')} />}
    >
      {role ? edit ? <EditRoleGlobal role={role} /> : <ViewRole role={role} /> : null}
    </PageTemplate>
  );
};
