import { ActionsType } from '@edanalytics/common-ui';
import { GetUserDto } from '@edanalytics/models';
import { BiEdit, BiIdCard, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { queryKey, userQueries } from '../../api';
import { globalUserAuthConfig, globalUtmAuthConfig, useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { useQueryClient } from '@tanstack/react-query';

export const useUserGlobalActions = (user: GetUserDto | undefined): ActionsType => {
  const location = useLocation();
  const search = useSearchParamsObject();
  const onApplicationPage = user && location.pathname.endsWith(`/users/${user.id}`);
  const inEdit = onApplicationPage && 'edit' in search && search?.edit === 'true';
  const popBanner = usePopBanner();
  const queryClient = useQueryClient();

  const navigate = useNavigate();
  const to = (id: number | string) => `/users/${id}`;
  const deleteUser = userQueries.useDelete({});

  const canView = useAuthorize(globalUserAuthConfig('user:read'));
  const canAssign = useAuthorize(globalUtmAuthConfig('user-tenant-membership:read'));
  const canEdit = useAuthorize(globalUserAuthConfig('user:update'));
  const canDelete = useAuthorize(globalUserAuthConfig('user:delete'));

  return user === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: HiOutlineEye,
                text: 'View',
                title: 'View ' + user.displayName,
                to: to(user.id),
                onClick: () => navigate(to(user.id)),
              },
            }
          : {}),
        ...(canAssign
          ? {
              Assign: {
                icon: BiIdCard,
                text: 'Add tenant',
                title: 'Add ' + user.displayName + ' to a tenant',
                to: `/user-tenant-memberships/create?userId=${user.id}`,
                onClick: () => navigate(`/user-tenant-memberships/create?userId=${user.id}`),
              },
            }
          : {}),
        ...(canEdit
          ? {
              Edit: {
                icon: BiEdit,
                isDisabled: inEdit,
                text: 'Edit',
                title: 'Edit ' + user.displayName,
                to: to(user.id) + '?edit=true',
                onClick: () => navigate(to(user.id) + '?edit=true'),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: BiTrash,
                isLoading: deleteUser.isLoading,
                text: 'Delete',
                title: 'Delete user',
                confirmBody: 'This will permanently delete the user.',
                onClick: () =>
                  deleteUser.mutateAsync(user.id, {
                    ...mutationErrCallback({ popBanner }),
                    onSuccess: () => {
                      queryClient.invalidateQueries(
                        queryKey({
                          resourceName: 'UserTenantMembership',
                          id: false,
                        })
                      );
                      navigate(`/users`);
                    },
                  }),
                confirm: true,
              },
            }
          : {}),
      };
};
