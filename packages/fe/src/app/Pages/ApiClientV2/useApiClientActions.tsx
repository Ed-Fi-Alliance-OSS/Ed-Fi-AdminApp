import { ActionsType, Icons } from '@edanalytics/common-ui';

import { GetApiClientDtoV2 } from '@edanalytics/models';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import {
  useAuthorize,
  useNavToParent,
  useTeamEdfiTenantNavContext,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { useSearchParamsObject } from '../../helpers/useSearch';

export const useSingleApiClientActions = ({
  apiClient,
}: {
  apiClient: (GetApiClientDtoV2) | undefined;
}): ActionsType => {
  const { edfiTenantId, asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();
  const location = useLocation();
  const popBanner = usePopBanner();

  const search = useSearchParamsObject();
  const onApiClientPage =
    apiClient && location.pathname.endsWith(`/apiclients/${apiClient.id}`);
  const inEdit = onApiClientPage && 'edit' in search && search?.edit === 'true';

  const parentPath = useNavToParent();

  const canEdit = true;
  const canReset = true;
  const canView = true;
  const canDelete = true;

  return apiClient === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + apiClient.name,
                to: `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/1/apiclients/${apiClient.id}`,
                onClick: () =>
                  navigate(
                    `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/1/apiclients/${apiClient.id}`
                  ),
              },
            }
          : undefined),
        ...(canReset
          ? {
              Reset: {
                isPending: false, // resetCreds.isPending,
                icon: Icons.ShieldX,
                text: 'Reset creds',
                title: 'Reset application credentials.',
                onClick: () => {
                  navigate(
                          `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/1/apiclients/${apiClient.id}/reset-creds`
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
                isDisabled: inEdit,
                icon: Icons.Edit,
                text: 'Edit',
                title: 'Edit ' + apiClient.name,
                to: `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/1/apiclients/${apiClient.id}?edit=true`,
                onClick: () =>
                  navigate(
                    `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/1/apiclients/${apiClient.id}?edit=true`
                  ),
              },
            }
          : undefined),
        ...(canDelete
          ? {
              Delete: {
                isPending: false, //deleteApplication.isPending,
                icon: Icons.Delete,
                text: 'Delete',
                title: 'Delete Application credentials',
                confirmBody:
                  'All systems using this application to access Ed-Fi will no longer be able to do so. This action cannot be undone, though you will be able to create a new application if you want.',
                onClick: () =>
                {
                  if (onApiClientPage) {
                    navigate(parentPath);
                  }
                }
              },
            }
          : undefined),
      };
};
export const useMultiApiClientsActions = ({
  teamId,
}: {
  edfiTenantId: string | number;
  teamId: string | number;
}): ActionsType => {
  const navigate = useNavigate();
  const { sbEnvironmentId, edfiTenantId } = useTeamEdfiTenantNavContext();
  const to = `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/1/apiclients/create`;
  const canCreate = true;
  return canCreate
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'New',
          title: 'New application credentials',
          to,
          onClick: () => navigate(to),
        },
      }
    : {};
};
