import { ActionsType } from '@edanalytics/common-ui';
import { BiPlus } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { globalOwnershipAuthConfig, useAuthorize } from '../../helpers';

export const useMultipleOwnershipGlobalActions = (): ActionsType => {
  const navigate = useNavigate();
  const canCreate = useAuthorize(globalOwnershipAuthConfig('ownership:create'));

  return canCreate
    ? {
        Create: {
          icon: BiPlus,
          text: 'Grant new',
          title: 'Grant new tenant resource ownership.',
          to: '/ownerships/create',
          onClick: () => navigate('/ownerships/create'),
        },
      }
    : {};
};
