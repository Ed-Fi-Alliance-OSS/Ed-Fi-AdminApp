import { ActionsType } from '@edanalytics/common-ui';
import { BiPlus } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { globalRoleAuthConfig, useAuthorize } from '../../helpers';

export const useMultipleRoleGlobalActions = (): ActionsType => {
  const navigate = useNavigate();

  const canCreate = useAuthorize(globalRoleAuthConfig('__filtered__', 'role:create'));
  return canCreate
    ? {
        Create: {
          icon: BiPlus,
          text: 'Create new',
          title: 'Create new user or ownership role.',
          to: '/roles/create',
          onClick: () => navigate('/roles/create'),
        },
      }
    : {};
};
