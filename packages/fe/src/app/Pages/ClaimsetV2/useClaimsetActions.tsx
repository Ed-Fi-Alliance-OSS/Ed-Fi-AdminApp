import { Link } from '@chakra-ui/react';
import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetClaimsetMultipleDtoV2 } from '@edanalytics/models';
import { RowSelectionState } from '@tanstack/react-table';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { claimsetQueriesV2, API_URL } from '../../api';
import { claimsetAuthConfig, useAuthorize, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useClaimsetActions = ({
  claimset,
}: {
  claimset: GetClaimsetMultipleDtoV2 | undefined;
}): ActionsType => {
  const { edfiTenant, asId, edfiTenantId, teamId } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();
  const to = (id: number | string) =>
    `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/claimsets/${id}`;
  const deleteClaimset = claimsetQueriesV2.delete({ edfiTenant, teamId: asId });
  const copyClaimset = claimsetQueriesV2.copy({ edfiTenant, teamId: asId });
  const createExport = claimsetQueriesV2.createExport({ edfiTenant, teamId: asId });
  const popBanner = usePopBanner();

  const canView = useAuthorize(
    claimsetAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.claimset:read')
  );
  const canEdit =
    useAuthorize(
      claimsetAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.claimset:update')
    ) &&
    claimset &&
    !claimset._isSystemReserved;
  const canDelete =
    useAuthorize(
      claimsetAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.claimset:delete')
    ) &&
    claimset &&
    !claimset._isSystemReserved;
  const canCreate = useAuthorize(
    claimsetAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.claimset:create')
  );

  return claimset
    ? {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + claimset.displayName,
                to: to(claimset.id),
                onClick: () => navigate(to(claimset.id)),
              },
              Export: {
                icon: Icons.Export,
                text: 'Export',
                title: 'Export ' + claimset.displayName,
                isPending: createExport.isPending,
                onClick: () =>
                  createExport.mutateAsync(
                    { entity: {}, pathParams: { ids: [claimset.id] } },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: (data) => {
                        popBanner({
                          type: 'Success',
                          title: claimset.displayName + ' export created',
                          message: (
                            <>
                              Download the file{' '}
                              <Link
                                color="blue.500"
                                textDecor="underline"
                                target="_blank"
                                as={RouterLink}
                                to={`${API_URL}/teams/${teamId}/edfi-tenants/${
                                  edfiTenant.id
                                }/admin-api/v2/claimsets/export/${data.id}`}
                              >
                                here
                              </Link>
                              .
                            </>
                          ),
                          regarding: 'Expires after five minutes.',
                        });
                      },
                    }
                  ),
              },
            }
          : {}),

        ...(canDelete
          ? {
              Delete: {
                icon: Icons.Delete,
                isPending: deleteClaimset.isPending,
                text: 'Delete',
                title: 'Delete claimset',
                confirmBody: 'This will permanently delete the claimset.',
                onClick: () =>
                  deleteClaimset.mutateAsync(
                    { id: claimset.id },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: () =>
                        navigate(
                          `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/claimsets`
                        ),
                    }
                  ),
                confirm: true,
              },
            }
          : {}),
        ...(canCreate
          ? {
              // Create: {
              //   icon: BiPlus,
              //   text: 'New',
              //   title: 'New claimset',
              //   to: toCreate,
              //   onClick: () => navigate(toCreate),
              // },
              Import: {
                icon: Icons.Copy,
                text: 'Copy',
                title: 'Copy claimset',
                to: to(claimset.id) + '/copy',
                onClick: () => navigate(to(claimset.id) + '/copy'),
              },
            }
          : {}),
      }
    : {};
};

export const useManyClaimsetActions = ({
  selectionState,
}: {
  selectionState: RowSelectionState;
}): ActionsType => {
  const { asId, edfiTenantId, edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();

  const createExport = claimsetQueriesV2.createExport({ edfiTenant, teamId: asId });
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const toCreate = `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/claimsets/create`;
  const toImport = `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/claimsets/import`;
  const canCreate = useAuthorize(
    claimsetAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.claimset:create')
  );
  const canRead = useAuthorize(
    claimsetAuthConfig(edfiTenantId, asId, 'team.sb-environment.edfi-tenant.claimset:read')
  );

  return {
    ...(canCreate
      ? {
          // Create: {
          //   icon: BiPlus,
          //   text: 'New',
          //   title: 'New claimset',
          //   to: toCreate,
          //   onClick: () => navigate(toCreate),
          // },
          Import: {
            icon: Icons.Import,
            text: 'Import',
            title: 'Import claimsets',
            to: toImport,
            onClick: () => navigate(toImport),
          },
        }
      : {}),
    ...(canRead && Object.keys(selectionState).length > 0
      ? {
          Export: {
            icon: Icons.Export,
            text: 'Export',
            title: 'Export selected claimsets',
            isPending: createExport.isPending,
            onClick: () =>
              createExport.mutateAsync(
                {
                  entity: {},
                  pathParams: { ids: Object.keys(selectionState).map((idStr) => Number(idStr)) },
                },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner }),
                  onSuccess: (data) => {
                    popBanner({
                      type: 'Success',
                      title: 'Export created',
                      message: (
                        <>
                          Download the file{' '}
                          <Link
                            color="blue.500"
                            textDecor="underline"
                            target="_blank"
                            as={RouterLink}
                            to={`${API_URL}/teams/${teamId}/edfi-tenants/${
                              edfiTenant.id
                            }/admin-api/v2/claimsets/export/${data.id}`}
                          >
                            here
                          </Link>
                          .
                        </>
                      ),
                      regarding: 'Expires after five minutes.',
                    });
                  },
                }
              ),
          },
        }
      : {}),
  };
};
