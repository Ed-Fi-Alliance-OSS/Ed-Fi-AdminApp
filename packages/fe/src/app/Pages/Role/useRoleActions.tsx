import { ActionPropsConfirm, ActionsType, LinkActionProps } from '@edanalytics/common-ui';
import { GetRoleDto } from '@edanalytics/models';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate, useParams } from 'react-router-dom';
import { roleQueries } from '../../api';
import { AuthorizeComponent, tenantRoleAuthConfig } from '../../helpers';
import { usePopBanner } from '../../Layout/FeedbackBanner';
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
  return role === undefined
    ? {}
    : {
        View: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const path = to(role.id);
          return (
            <AuthorizeComponent
              config={tenantRoleAuthConfig(role.id, Number(params.asId), 'tenant.role:read')}
            >
              <props.children
                icon={HiOutlineEye}
                text="View"
                title={'View ' + role.displayName}
                to={path}
                onClick={() => navigate(path)}
              />
            </AuthorizeComponent>
          );
        },
        Edit: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const path = to(role.id);
          return (
            <AuthorizeComponent
              config={tenantRoleAuthConfig(role.id, role.tenantId, 'tenant.role:update')}
            >
              <props.children
                icon={BiEdit}
                text="Edit"
                title={'Edit ' + role.displayName}
                to={to + '?edit=true'}
                onClick={() => navigate(to + '?edit=true')}
              />
            </AuthorizeComponent>
          );
        },
        Delete: (props: { children: (props: ActionPropsConfirm) => JSX.Element }) => {
          return (
            <AuthorizeComponent
              config={tenantRoleAuthConfig(role.id, role.tenantId, 'tenant.role:delete')}
            >
              <props.children
                icon={BiTrash}
                isLoading={deleteRole.isLoading}
                text="Delete"
                title="Delete role"
                confirmBody="This will permanently delete the role."
                onClick={() =>
                  deleteRole.mutateAsync(role.id, {
                    ...mutationErrCallback({ popBanner }),
                    onSuccess: () => navigate(`/as/${params.asId}/roles`),
                  })
                }
                confirm={true}
              />
            </AuthorizeComponent>
          );
        },
      };
};
