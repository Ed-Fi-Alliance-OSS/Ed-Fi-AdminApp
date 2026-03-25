import { ActionsType, Icons } from '@edanalytics/common-ui';

import { GetApiClientDtoV2 } from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useAuthorize,
  useTeamEdfiTenantNavContext,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { apiClientQueriesV2 } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';

export const useSingleApiClientActions = ({
  apiClient,
  applicationId,
}: {
  apiClient: GetApiClientDtoV2 | undefined;
  applicationId: number;
}): ActionsType => {
  const queryClient = useQueryClient();
  const { edfiTenantId, asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();
  const { apiClientId } = useParams();
  const popBanner = usePopBanner();

  const deleteApiClient = apiClientQueriesV2.delete({
    edfiTenant,
    teamId: asId,
  });

  const search = useSearchParamsObject();
  const onApiClientPage = !!apiClientId;
  const inEdit = onApiClientPage && 'edit' in search && search?.edit === 'true';

  const canView = true;
  const canCreate = true;
  const canReset = true;
  const canEdit = true;
  const canDelete = useAuthorize(
    apiClient && {
      privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
      subject: {
        edfiTenantId: Number(edfiTenantId),
        teamId: Number(asId),
        id: '__filtered__',
      },
    }
  );
  const toView = `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${applicationId}/apiclients/${apiClient?.id}`;
  const toCreate = `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${applicationId}/apiclients/create`;
  const toEdit = `${toView}?edit=true`;

  return apiClient === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + apiClient.name,
                to: toView,
                onClick: () => navigate(toView),
              },
            }
          : undefined),
        ...(canCreate
          ? {
              Create: {
                icon: Icons.Plus,
                text: 'New',
                title: 'New credentials',
                to: toCreate,
                onClick: () => navigate(toCreate),
              },
            }
          : undefined),
        ...(canReset
          ? {
              Reset: {
                isDisabled: false,
                icon: Icons.Application,
                text: 'Reset',
                title: 'Reset ' + apiClient.name,
                onClick: () => {},
              },
            }
          : undefined),
        ...(canEdit
          ? {
              Edit: {
                isDisabled: !!inEdit,
                icon: Icons.Edit,
                text: 'Edit',
                title: 'Edit ' + apiClient.name,
                to: toEdit,
                onClick: () => navigate(toEdit),
              },
            }
          : undefined),
        ...(canDelete
          ? {
              Delete: {
                isPending: deleteApiClient.isPending,
                icon: Icons.Delete,
                text: 'Delete',
                title: 'Delete API client credentials',
                confirmBody:
                  'All systems using these credentials to access Ed-Fi will no longer be able to do so. This action cannot be undone, but you will be able to create new credentials for this application if you want.',
                onClick: () =>
                  deleteApiClient.mutate(
                    { id: apiClient.id, pathParams: {} },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: () => {
                        queryClient.invalidateQueries({
                          queryKey: apiClientQueriesV2.getAll(
                            {
                              teamId: asId,
                              edfiTenant,
                            },
                            {
                              applicationId,
                            }
                          ).queryKey,
                        });
                        if (onApiClientPage) {
                          navigate(
                            `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${applicationId}/apiclients`
                          );
                        }
                      },
                    }
                  ),
                confirm: true,
              },
            }
          : undefined),
      };
};

export const useMultiApiClientsActions = ({
  teamId,
  applicationId,
}: {
  teamId: string | number;
  applicationId: number;
}): ActionsType => {
  const navigate = useNavigate();
  const { sbEnvironmentId, edfiTenantId } = useTeamEdfiTenantNavContext();
  const to = `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${applicationId}/apiclients/create`;
  const canCreate = true;
  return canCreate
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'New',
          title: 'New credentials',
          to,
          onClick: () => navigate(to),
        },
      }
    : {};
};