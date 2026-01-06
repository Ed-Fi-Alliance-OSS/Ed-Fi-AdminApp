import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetEdorgDto } from '@edanalytics/models';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { edorgQueries } from '../../api';
import {
  teamEdfiTenantAuthConfig,
  useAuthorize,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useEdorgActions = (edorg: Pick<GetEdorgDto, 'id'>): ActionsType => {
  const navigate = useNavigate();
  const { edfiTenantId, edfiTenant, sbEnvironmentId, sbEnvironment, teamId } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();
  const { edorgId } = useParams();

  const displayOptions = sbEnvironment?.startingBlocks;

  const canDelete = useAuthorize(
    teamEdfiTenantAuthConfig(
      edorg.id,
      edfiTenantId,
      teamId,
      'team.sb-environment.edfi-tenant.ods:delete-edorg'
    )
  );
  const deleteEdorg = edorgQueries.delete({ edfiTenant, teamId });

  return {
    ...(canDelete && displayOptions
      ? {
          Delete: {
            icon: Icons.Delete,
            isPending: deleteEdorg.isPending,
            text: 'Delete',
            title: 'Delete ed-org',
            confirmBody: 'This will permanently delete the edorg.',
            onClick: () =>
              deleteEdorg.mutateAsync(
                { id: edorg.id },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner }),
                  onSuccess: () =>
                    edorgId &&
                    navigate(
                      `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/edorgs`
                    ),
                }
              ),
            confirm: true,
          },
        }
      : {}),
  };
};
