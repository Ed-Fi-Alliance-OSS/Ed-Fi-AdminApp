import { ActionsType } from '@edanalytics/common-ui';
import { GetTenantDto } from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { BiArch, BiEdit, BiTrash, BiUserPlus } from 'react-icons/bi';
import { BsClipboardPlus } from 'react-icons/bs';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { tenantQueries } from '../../api';
import { globalTenantAuthConfig, useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useTenantActions = (tenant: GetTenantDto | undefined): ActionsType => {
  const navigate = useNavigate();
  const popBanner = usePopBanner();
  const to = (id: number | string) => `/tenants/${id}`;
  const queryClient = useQueryClient();
  const deleteTenant = tenantQueries.useDelete({});

  const canAssume = useAuthorize(globalTenantAuthConfig('tenant:read'));
  const canInvite = useAuthorize(globalTenantAuthConfig('user-tenant-membership:create'));
  const canShare = useAuthorize(globalTenantAuthConfig('ownership:create'));
  const canView = useAuthorize(globalTenantAuthConfig('tenant:read'));
  const canEdit = useAuthorize(globalTenantAuthConfig('tenant:update'));
  const canDelete = useAuthorize(globalTenantAuthConfig('tenant:delete'));

  return tenant === undefined
    ? {}
    : {
        ...(canAssume
          ? {
              Assume: {
                icon: BiArch,
                text: 'Assume',
                title: 'Assume ' + tenant.displayName + ' tenant scope',
                to: `/as/${tenant.id}`,
                onClick: () => navigate(`/as/${tenant.id}`),
              },
            }
          : {}),
        ...(canInvite
          ? {
              Invite: {
                icon: BiUserPlus,
                text: 'Add user',
                title: 'Add existing user to ' + tenant.displayName,
                to: `/user-tenant-memberships/create?tenantId=${tenant.id}`,
                onClick: () => navigate(`/user-tenant-memberships/create?tenantId=${tenant.id}`),
              },
            }
          : {}),
        ...(canShare
          ? {
              Share: {
                icon: BsClipboardPlus,
                text: 'Add resource',
                title: 'Give ' + tenant.displayName + ' a new resource ownership',
                to: `/ownerships/create?tenantId=${tenant.id}`,
                onClick: () => navigate(`/ownerships/create?tenantId=${tenant.id}`),
              },
            }
          : {}),
        ...(canView
          ? {
              View: {
                icon: HiOutlineEye,
                text: 'View',
                title: 'View ' + tenant.displayName,
                to: to(tenant.id),
                onClick: () => navigate(to(tenant.id)),
              },
            }
          : {}),
        ...(canEdit
          ? {
              Edit: {
                icon: BiEdit,
                text: 'Edit',
                title: 'Edit ' + tenant.displayName,
                to: to(tenant.id) + '?edit=true',
                onClick: () => navigate(to(tenant.id) + '?edit=true'),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: BiTrash,
                text: 'Delete',
                title: 'Delete tenant',
                confirmBody: 'This will permanently delete the tenant.',
                onClick: () =>
                  deleteTenant.mutateAsync(tenant.id, {
                    ...mutationErrCallback({ popGlobalBanner: popBanner }),
                    onSuccess: () => {
                      queryClient.invalidateQueries([]);
                      navigate(`/tenants`);
                    },
                  }),
                confirm: true,
              },
            }
          : {}),
      };
};
