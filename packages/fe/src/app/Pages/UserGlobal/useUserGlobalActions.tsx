import { ActionPropsConfirm, ActionsType, LinkActionProps } from '@edanalytics/common-ui';
import { GetUserDto } from '@edanalytics/models';
import { BiEdit, BiIdCard, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { userQueries } from '../../api';
import { AuthorizeComponent } from '../../helpers';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useUserGlobalActions = (user: GetUserDto | undefined): ActionsType => {
  const params = useParams() as {
    userId: string;
  };
  const location = useLocation();
  const search = useSearchParamsObject();
  const onApplicationPage = user && location.pathname.endsWith(`/users/${user.id}`);
  const inEdit = onApplicationPage && 'edit' in search && search?.edit === 'true';
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const to = (id: number | string) => `/users/${id}`;
  const deleteUser = userQueries.useDelete({});
  return user === undefined
    ? {}
    : {
        View: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const path = to(user.id);
          return (
            <AuthorizeComponent
              config={{
                privilege: 'user:read',
                subject: {
                  id: user.id,
                },
              }}
            >
              <props.children
                icon={HiOutlineEye}
                text="View"
                title={'View ' + user.displayName}
                to={path}
                onClick={() => navigate(path)}
              />
            </AuthorizeComponent>
          );
        },
        Assign: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const path = `/user-tenant-memberships/create?userId=${user.id}`;
          return (
            <AuthorizeComponent
              config={{
                privilege: 'user-tenant-membership:create',
                subject: {
                  id: '__filtered__',
                },
              }}
            >
              <props.children
                icon={BiIdCard}
                text="Add tenant"
                title={'Add ' + user.displayName + ' to a tenant'}
                to={path}
                onClick={() => navigate(path)}
              />
            </AuthorizeComponent>
          );
        },
        Edit: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const path = to(user.id);
          return (
            <AuthorizeComponent
              config={{
                privilege: 'user:update',
                subject: {
                  id: user.id,
                },
              }}
            >
              <props.children
                icon={BiEdit}
                isDisabled={inEdit}
                text="Edit"
                title={'Edit ' + user.displayName}
                to={path + '?edit=true'}
                onClick={() => navigate(path + '?edit=true')}
              />
            </AuthorizeComponent>
          );
        },
        Delete: (props: { children: (props: ActionPropsConfirm) => JSX.Element }) => {
          return (
            <AuthorizeComponent
              config={{
                privilege: 'user:delete',
                subject: {
                  id: user.id,
                },
              }}
            >
              <props.children
                icon={BiTrash}
                isLoading={deleteUser.isLoading}
                text="Delete"
                title="Delete user"
                confirmBody="This will permanently delete the user."
                onClick={() =>
                  deleteUser.mutateAsync(user.id, {
                    ...mutationErrCallback({ popBanner }),
                    onSuccess: () => navigate(`/users`),
                  })
                }
                confirm={true}
              />
            </AuthorizeComponent>
          );
        },
      };
};
