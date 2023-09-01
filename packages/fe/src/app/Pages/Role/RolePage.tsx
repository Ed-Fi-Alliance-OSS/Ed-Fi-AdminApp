import { ActionBarActions, PageTemplate } from '@edanalytics/common-ui';
import _ from 'lodash';
import { useNavigate, useParams } from 'react-router-dom';
import { roleQueries } from '../../api';
import { useNavToParent } from '../../helpers';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditRole } from './EditRole';
import { ViewRole } from './ViewRole';
import { useRoleActions } from './useRoleActions';

export const RolePage = () => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const params = useParams() as {
    asId: string;
    roleId: string;
  };
  const deleteRole = roleQueries.useDelete({
    callback: () => {
      navigate(navToParentOptions);
    },
    tenantId: params.asId,
  });
  const role = roleQueries.useOne({
    id: params.roleId,
    tenantId: params.asId,
  }).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };
  const actions = useRoleActions(role);

  return (
    <PageTemplate
      constrainWidth
      title={role?.displayName || 'Role'}
      actions={<ActionBarActions actions={_.omit(actions, 'View')} />}
    >
      {role ? edit ? <EditRole role={role} /> : <ViewRole role={role} /> : null}
    </PageTemplate>
  );
};
