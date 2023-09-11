import { ActionsType } from '@edanalytics/common-ui';
import { BiPlus } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { globalTenantAuthConfig, useAuthorize } from '../../helpers';

// TODO rename the multi-item versions to something other than just the extra "s", which isn't visible enough.
export const useTenantsActions = (): ActionsType => {
  const navigate = useNavigate();

  const canCreate = useAuthorize(globalTenantAuthConfig('tenant:create'));

  return canCreate
    ? {
        Create: {
          icon: BiPlus,
          text: 'Create new',
          title: 'Create new tenant.',
          to: '/tenants/create',
          onClick: () => navigate('/tenants/create'),
        },
      }
    : {};
};
