import _ from 'lodash';
import { useParams } from 'react-router-dom';
import { roleQueries } from '../../api';
import { ActionBarActions } from '../../helpers/ActionBarActions';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { PageTemplate } from '../PageTemplate';
import { EditRoleGlobal } from './EditRoleGlobal';
import { useRoleGlobalActions } from './useRoleGlobalActions';
import { ViewRole } from '../Role/ViewRole';

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
      {role ? edit ? <EditRoleGlobal /> : <ViewRole role={role} /> : null}
    </PageTemplate>
  );
};
