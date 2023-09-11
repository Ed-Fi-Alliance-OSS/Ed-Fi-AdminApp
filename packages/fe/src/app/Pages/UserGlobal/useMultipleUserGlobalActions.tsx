import { ActionsType } from '@edanalytics/common-ui';
import { BiPlus } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { globalUserAuthConfig, useAuthorize } from '../../helpers';

export const useMultipleUserGlobalActions = (): ActionsType => {
  const navigate = useNavigate();

  const canCreate = useAuthorize(globalUserAuthConfig('user:create'));

  return canCreate
    ? {
        Create: {
          icon: BiPlus,
          text: 'Create new',
          title: 'Create new application user.',
          to: '/users/create',
          onClick: () => navigate('/users/create'),
        },
      }
    : {};
};
