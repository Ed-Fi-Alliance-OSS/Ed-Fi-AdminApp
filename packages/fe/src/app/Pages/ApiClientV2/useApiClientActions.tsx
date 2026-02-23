import { ActionsType, Icons } from '@edanalytics/common-ui';

import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  useTeamEdfiTenantNavContext,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { GetApiClientDtoV2 } from 'packages/models/src/dtos/edfi-admin-api.v2.dto';
import { useSearchParamsObject } from '../../helpers/useSearch';

export const useSingleApiClientActions = ({
  apiClient,
  applicationId
}: {
  apiClient: (GetApiClientDtoV2) | undefined;
  applicationId: number;
}): ActionsType => {
  const { edfiTenantId, asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();

  const canView = true;
  const to = `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${applicationId}/apiclients/${apiClient?.id}`;

  return apiClient === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: Icons.View,
                text: 'View',
                title: 'View ' + apiClient.name,
                to,
                onClick: () => navigate(to),
              },
            }
          : undefined)
      };
};

export const useMultiApiClientsActions = ({
  teamId,
  applicationId,
}: {
  edfiTenantId: string | number;
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