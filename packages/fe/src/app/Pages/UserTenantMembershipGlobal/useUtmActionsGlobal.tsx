import { ActionsType } from '@edanalytics/common-ui';
import { GetUserTenantMembershipDto } from '@edanalytics/models';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { userTenantMembershipQueries } from '../../api';
import { globalUtmAuthConfig, useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useUtmActionsGlobal = (
  userTenantMembership: GetUserTenantMembershipDto | undefined
): ActionsType => {
  const navigate = useNavigate();
  const popBanner = usePopBanner();
  const to = (id: number | string) => `/user-tenant-memberships/${id}`;
  const deleteUtm = userTenantMembershipQueries.useDelete({});

  const canView = useAuthorize(globalUtmAuthConfig('user-tenant-membership:read'));
  const canEdit = useAuthorize(globalUtmAuthConfig('user-tenant-membership:update'));
  const canDelete = useAuthorize(globalUtmAuthConfig('user-tenant-membership:delete'));

  return userTenantMembership === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: HiOutlineEye,
                text: 'View',
                title: 'View ' + userTenantMembership.displayName,
                to: to(userTenantMembership.id),
                onClick: () => navigate(to(userTenantMembership.id)),
              },
            }
          : {}),
        ...(canEdit
          ? {
              Edit: {
                icon: BiEdit,
                text: 'Edit',
                title: 'Edit ' + userTenantMembership.displayName,
                to: to(userTenantMembership.id) + '?edit=true',
                onClick: () => navigate(to(userTenantMembership.id) + '?edit=true'),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: BiTrash,
                text: 'Delete',
                title: 'Delete tenant membership',
                confirmBody: 'This will permanently delete the tenant membership.',
                onClick: () =>
                  deleteUtm.mutateAsync(userTenantMembership.id, {
                    ...mutationErrCallback({ popBanner }),
                    onSuccess: () => navigate(`/user-tenant-memberships`),
                  }),
                confirm: true,
              },
            }
          : {}),
      };
};
