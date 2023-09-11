import { Button } from '@chakra-ui/react';
import { ActionsType } from '@edanalytics/common-ui';
import { GetRoleDto } from '@edanalytics/models';
import { IWorkflowFailureErrors, StatusType, isWorkflowFailureResponse } from '@edanalytics/utils';
import { useQueryClient } from '@tanstack/react-query';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { queryKey, roleQueries } from '../../api';
import { globalRoleAuthConfig, useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useRoleGlobalActions = (role: GetRoleDto | undefined): ActionsType => {
  const navigate = useNavigate();
  const to = (id: number | string) => `/roles/${id}`;
  const deleteRole = roleQueries.useDelete({});
  const popBanner = usePopBanner();
  const queryClient = useQueryClient();

  const canView = useAuthorize(globalRoleAuthConfig(role?.id, 'role:read'));

  const canEdit = useAuthorize(globalRoleAuthConfig(role?.id, 'role:update'));
  const canDelete = useAuthorize(globalRoleAuthConfig(role?.id, 'role:delete'));

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
                text: 'Delete',
                title: 'Delete role',
                confirmBody: 'This will permanently delete the role.',
                onClick: () =>
                  deleteRole.mutateAsync(role.id, {
                    onError: (err: IWorkflowFailureErrors | any) => {
                      if (isWorkflowFailureResponse(err) && err.code === 'REQUIRES_FORCE_DELETE') {
                        popBanner((props) => ({
                          status: StatusType.error,
                          message: (
                            <>
                              {err.errors.message?.toString() ??
                                'This role is referenced by other entities.'}
                              <Button
                                ml={4}
                                size="sm"
                                h="auto"
                                py={1}
                                colorScheme="red"
                                variant="outline"
                                onClick={() => {
                                  deleteRole.mutateAsync(
                                    { id: role.id, force: true },
                                    {
                                      onSuccess: () => {
                                        queryClient.invalidateQueries({
                                          queryKey: queryKey({
                                            resourceName: 'UserTenantMembership',
                                            id: false,
                                          }),
                                        });
                                        queryClient.invalidateQueries({
                                          queryKey: queryKey({
                                            resourceName: 'User',
                                            id: false,
                                          }),
                                        });
                                        queryClient.invalidateQueries({
                                          queryKey: queryKey({
                                            resourceName: 'Ownership',
                                            id: false,
                                          }),
                                        });
                                      },
                                      ...mutationErrCallback({ popBanner }),
                                      onSettled: props.onDelete,
                                    }
                                  );
                                }}
                              >
                                Use force delete
                              </Button>
                            </>
                          ),
                          title: 'Force delete required',
                        }));
                        return undefined;
                      }
                      mutationErrCallback({ popBanner }).onError(err);
                    },
                    onSuccess: () => navigate(`/roles`),
                  }),
                confirm: true,
              },
            }
          : {}),
      };
};
