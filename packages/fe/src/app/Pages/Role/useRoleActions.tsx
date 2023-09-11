import { ActionsType } from '@edanalytics/common-ui';
import { GetRoleDto } from '@edanalytics/models';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { roleQueries } from '../../api';
import { tenantRoleAuthConfig, useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useRoleActions = (role: GetRoleDto | undefined): ActionsType => {
  const navigate = useNavigate();
  const to = (id: number | string) => `/roles/${id}`;
  const deleteRole = roleQueries.useDelete({});
  const popBanner = usePopBanner();
  const params = useParams() as {
    asId: string;
    roleId: string;
  };

  const canView = useAuthorize(
    tenantRoleAuthConfig(role?.id, Number(params.asId), 'tenant.role:read')
  );

  const canEdit = useAuthorize(
    tenantRoleAuthConfig(role?.id, Number(params.asId), 'tenant.role:update')
  );

  const canDelete = useAuthorize(
    tenantRoleAuthConfig(role?.id, Number(params.asId), 'tenant.role:delete')
  );

  return role === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: HiOutlineEye,
                text: 'View',
                title: 'View ' + role.displayName,
                to: to(role.id),
                onClick: () => navigate(to(role.id)),
              },
            }
          : {}),
        ...(canEdit
          ? {
              Edit: {
                icon: BiEdit,
                text: 'Edit',
                title: 'Edit ' + role.displayName,
                to: to(role.id) + '?edit=true',
                onClick: () => navigate(to(role.id) + '?edit=true'),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: BiTrash,
                isLoading: deleteRole.isLoading,
                text: 'Delete',
                title: 'Delete role',
                confirmBody: 'This will permanently delete the role.',
                onClick: () =>
                  deleteRole.mutateAsync(role.id, {
                    ...mutationErrCallback({ popBanner }),
                    onSuccess: () => navigate(`/roles`),
                  }),
                confirm: true,
              },
            }
          : {}),
      };
};
