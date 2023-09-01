import { Button, ButtonGroup } from '@chakra-ui/react';
import {
  ActionPropsConfirm,
  ActionsType,
  BasicConfirmationModal,
  LinkActionProps,
} from '@edanalytics/common-ui';
import { GetRoleDto } from '@edanalytics/models';
import { IWorkflowFailureErrors, StatusType, isWorkflowFailureResponse } from '@edanalytics/utils';
import { useState } from 'react';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { roleQueries } from '../../api';
import { AuthorizeComponent, globalRoleAuthConfig } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';

export const useRoleGlobalActions = (role: GetRoleDto | undefined): ActionsType => {
  const navigate = useNavigate();
  const search = useSearchParamsObject();
  const to = (id: number | string) => `/roles/${id}`;
  const deleteRole = roleQueries.useDelete({});
  const popBanner = usePopBanner();

  const [forceDeleteMsg, setForceDeleteMsg] = useState<string | null>(null);

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
                isDisabled={'edit' in search && search.edit === 'true'}
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
              <>
                <BasicConfirmationModal
                  headerText="This role is still used. Force delete and set references to null?"
                  isOpen={!!forceDeleteMsg}
                  onClose={() => setForceDeleteMsg(null)}
                  action={() => {
                    setForceDeleteMsg(null);
                    deleteRole.mutateAsync(
                      { id: role.id, force: true },
                      { ...mutationErrCallback({ popBanner }), onSuccess: () => navigate(`/roles`) }
                    );
                  }}
                  noButtonText="No"
                  yesButtonText="Yes"
                  bodyText={forceDeleteMsg ?? undefined}
                  children={undefined}
                />
                <props.children
                  icon={BiTrash}
                  isLoading={deleteRole.isLoading}
                  text="Delete"
                  title="Delete role"
                  confirmBody="This will permanently delete the role."
                  onClick={() =>
                    deleteRole.mutateAsync(role.id, {
                      onError: (err: IWorkflowFailureErrors | any) => {
                        if (
                          isWorkflowFailureResponse(err) &&
                          err.code === 'REQUIRES_FORCE_DELETE'
                        ) {
                          setForceDeleteMsg(
                            err.errors.message?.toString() ??
                              'This role is referenced by other entities.'
                          );
                          return undefined;
                        }
                        mutationErrCallback({ popBanner }).onError(err);
                      },
                      onSuccess: () => navigate(`/roles`),
                    })
                  }
                  confirm={true}
                />
              </>
            </AuthorizeComponent>
          );
        },
      };
};
