import { ActionPropsConfirm, ActionsType, LinkActionProps } from '@edanalytics/common-ui';
import { GetUserTenantMembershipDto } from '@edanalytics/models';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { userTenantMembershipQueries } from '../../api';
import { AuthorizeComponent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { usePopBanner } from '../../Layout/FeedbackBanner';

export const useUtmActionsGlobal = (
  userTenantMembership: GetUserTenantMembershipDto | undefined
): ActionsType => {
  const navigate = useNavigate();
  const popBanner = usePopBanner();
  const to = (id: number | string) => `/user-tenant-memberships/${id}`;
  const deleteUtm = userTenantMembershipQueries.useDelete({});
  return userTenantMembership === undefined
    ? {}
    : {
        View: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const path = to(userTenantMembership.id);
          return (
            <AuthorizeComponent
              config={{
                privilege: 'user-tenant-membership:read',
                subject: {
                  id: userTenantMembership.id,
                },
              }}
            >
              <props.children
                icon={HiOutlineEye}
                text="View"
                title={'View ' + userTenantMembership.displayName}
                to={path}
                onClick={() => navigate(path)}
              />
            </AuthorizeComponent>
          );
        },
        Edit: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const path = to(userTenantMembership.id);
          return (
            <AuthorizeComponent
              config={{
                privilege: 'user-tenant-membership:update',
                subject: {
                  id: userTenantMembership.id,
                },
              }}
            >
              <props.children
                icon={BiEdit}
                text="Edit"
                title={'Edit ' + userTenantMembership.displayName}
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
                privilege: 'user-tenant-membership:update',
                subject: {
                  id: userTenantMembership.id,
                },
              }}
            >
              <props.children
                icon={BiTrash}
                isLoading={deleteUtm.isLoading}
                text="Delete"
                title="Delete tenant membership"
                confirmBody="This will permanently delete the tenant membership."
                onClick={() =>
                  deleteUtm.mutateAsync(userTenantMembership.id, {
                    ...mutationErrCallback({ popBanner }),
                    onSuccess: () => navigate(`/user-tenant-memberships`),
                  })
                }
                confirm={true}
              />
            </AuthorizeComponent>
          );
        },
      };
};
