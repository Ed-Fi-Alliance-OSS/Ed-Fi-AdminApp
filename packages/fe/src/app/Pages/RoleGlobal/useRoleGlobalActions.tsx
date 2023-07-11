import { GetRoleDto } from '@edanalytics/models';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { roleQueries } from '../../api';
import { AuthorizeComponent, globalRoleAuthConfig } from '../../helpers';
import { ActionPropsConfirm, ActionsType, LinkActionProps } from '../../helpers/ActionsType';

export const useRoleGlobalActions = (role: GetRoleDto | undefined): ActionsType => {
  const navigate = useNavigate();
  const to = (id: number | string) => `/roles/${id}`;
  const deleteRole = roleQueries.useDelete({});
  return role === undefined
    ? {}
    : {
        View: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const path = to(role.id);
          return (
            <AuthorizeComponent config={globalRoleAuthConfig(role.id, 'role:read')}>
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
            <AuthorizeComponent config={globalRoleAuthConfig(role.id, 'role:update')}>
              <props.children
                icon={BiEdit}
                text="Edit"
                title={'Edit ' + role.displayName}
                to={path + '?edit=true'}
                onClick={() => navigate(path + '?edit=true')}
              />
            </AuthorizeComponent>
          );
        },
        Delete: (props: { children: (props: ActionPropsConfirm) => JSX.Element }) => {
          return (
            <AuthorizeComponent config={globalRoleAuthConfig(role.id, 'role:delete')}>
              <props.children
                icon={BiTrash}
                text="Delete"
                title="Delete role"
                confirmBody="This will permanently delete the role."
                onClick={() =>
                  deleteRole.mutateAsync(role.id, {
                    onSuccess: () => navigate(`/roles`),
                  })
                }
                confirm={true}
              />
            </AuthorizeComponent>
          );
        },
      };
};
