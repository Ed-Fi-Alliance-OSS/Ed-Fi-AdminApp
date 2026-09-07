import { ActionsType, Icons } from '@edanalytics/common-ui';

import { UseQueryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import {
  useAuthorize,
  useTeamEdfiTenantNavContext,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { ApiClientEntity, useApiClientConfig } from './apiClientConfig';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';

export const useSingleApiClientActions = ({
  apiClient,
  applicationId,
}: {
  apiClient: ApiClientEntity | undefined;
  applicationId: number;
}): ActionsType => {
  const queryClient = useQueryClient();
  const { edfiTenantId, asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();
  const { apiClientId } = useParams();
  const popBanner = usePopBanner();
  const { queries } = useApiClientConfig();

  const deleteApiClient = queries.delete({
    edfiTenant,
    teamId: asId,
  });
  // Resolved through the version config rather than the api-v2
  // `useResetIntegrationApiClientCredentials` hook (which is hard-wired to
  // apiClientQueriesV2), so a v3 tenant hits the V3 reset-credential endpoint.
  const resetApiClientCredentials = queries.resetCreds({
    edfiTenant,
    teamId: asId,
  });

  // An Application with no credentials disappears from the UI entirely (AC-616),
  // so the last one may not be deleted. NameCell already runs this exact query
  // with the same key, so TanStack Query serves it from cache there rather than
  // issuing a second request.
  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type. Same workaround as ApiClientsPage.tsx/NameCell.tsx.
  // The query builder defaults `throwOnError` to true, which is fine for
  // NameCell (the table row itself), but this hook also backs
  // ApiClientPageActions, which — unlike the rest of the detail page — is not
  // wrapped in an ErrorBoundary. Left at the default, a failed credential
  // count would throw during render and take down the whole page. Override it
  // to false here and fail closed instead (see blockDelete below): the BFF's
  // 409 still enforces the rule server-side, so a blocked button on a failed
  // count costs the user nothing, while an enabled one could orphan the
  // Application.
  const applicationApiClients = useQuery({
    ...(queries.getAll(
      {
        teamId: asId,
        edfiTenant,
      },
      {
        applicationId,
      }
    ) as UseQueryOptions<Record<string | number, ApiClientEntity>>),
    throwOnError: false,
  });
  // Gated on `isSuccess` because this drives the tooltip wording: on a failed
  // query `isPending` is false and `data` is undefined, which would otherwise
  // make this true and put "this is the only credential" on a button whose
  // real count we do not know. Also covers 0 rather than exactly 1 — an
  // Application cannot reach this UI with zero credentials today, and blocking
  // is the safe default either way.
  const isOnlyApiClient =
    applicationApiClients.isSuccess &&
    Object.keys(applicationApiClients.data ?? {}).length <= 1;
  // Fails closed: a pending or errored count blocks the delete too. The
  // tooltip stays generic in those states because we cannot honestly claim
  // this is the only credential; the BFF's 409 enforces the rule server-side.
  const blockDelete =
    applicationApiClients.isPending || applicationApiClients.isError || isOnlyApiClient;

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
  const toView = `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${applicationId}/apiClients/${apiClient?.id}`;
  const toCreate = `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${applicationId}/apiClients/create`;
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
                isPending: resetApiClientCredentials.isPending,
                isDisabled: false,
                icon: Icons.ShieldX,
                text: 'Reset creds',
                title: 'Reset ' + apiClient.name,
                onClick: () => {
                  resetApiClientCredentials.mutateAsync(
                    { entity: { id: apiClient.id }, pathParams: {} },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: (result) => {
                        navigate(toView, { state: result });
                      },
                    }
                  );
                },
                confirm: true,
                confirmBody:
                  'Are you sure you want to reset the credentials? Anything using the current ones will stop working.',
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
                isDisabled: blockDelete,
                icon: Icons.Delete,
                text: 'Delete',
                title: isOnlyApiClient
                  ? "This is the Application's only credential and can't be deleted. Create another credential first."
                  : 'Delete API client credentials',
                confirmBody:
                  'All systems using these credentials to access Ed-Fi will no longer be able to do so. This action cannot be undone, but you will be able to create new credentials for this application if you want.',
                onClick: () =>
                  deleteApiClient.mutate(
                    { id: apiClient.id, pathParams: {} },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: () => {
                        queryClient.invalidateQueries({
                          queryKey: queries.getAll(
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
                            `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${applicationId}/apiClients`
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
  const to = `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${applicationId}/apiClients/create`;
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