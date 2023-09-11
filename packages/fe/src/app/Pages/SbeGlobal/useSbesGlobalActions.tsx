import { ActionsType } from '@edanalytics/common-ui';
import { BiPlus } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { globalSbeAuthConfig, useAuthorize } from '../../helpers';

export const useSbesGlobalActions = (): ActionsType => {
  const navigate = useNavigate();

  const canCreate = useAuthorize(globalSbeAuthConfig('__filtered__', 'sbe:create'));

  return canCreate
    ? {
        Create: {
          icon: BiPlus,
          text: 'Create',
          title: 'Create new environment.',
          to: '/sbes/create',
          onClick: () => navigate('/sbes/create'),
        },
      }
    : {};
};
