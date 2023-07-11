import { Button } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ReactNode } from 'react';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { roleQueries } from '../../api';
import { AuthorizeComponent, tenantRoleAuthConfig, useNavToParent } from '../../helpers';
import { roleIndexRoute } from '../../routes';
import { PageTemplate } from '../PageTemplate';
import { EditRole } from './EditRole';
import { ViewRole } from './ViewRole';
import { useRoleActions } from './useRoleActions';
import { ActionBarActions } from '../../helpers/ActionBarActions';
import _ from 'lodash';
import { useSearchParamsObject } from '../../helpers/useSearch';

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
      {role ? edit ? <EditRole /> : <ViewRole role={role} /> : null}
    </PageTemplate>
  );
};
