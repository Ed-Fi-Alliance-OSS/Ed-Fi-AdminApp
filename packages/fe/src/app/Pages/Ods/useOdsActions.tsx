import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetOdsDto } from '@edanalytics/models';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { odsQueries } from '../../api';
import {
  teamEdfiTenantAuthConfig,
  useAuthorize,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useOdsActions = (ods: Pick<GetOdsDto, 'id'>): ActionsType => {
  const navigate = useNavigate();
  const { edfiTenantId, edfiTenant, sbEnvironmentId, sbEnvironment, teamId } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();
  const { odsId } = useParams();

  const canDelete = useAuthorize(
    teamEdfiTenantAuthConfig(
      ods.id,
      edfiTenantId,
      teamId,
      'team.sb-environment.edfi-tenant:delete-ods'
    )
  );
  const deleteOds = odsQueries.delete({ edfiTenant, teamId });

  return {
    ...(canDelete && sbEnvironment.startingBlocks
      ? {
          Delete: {
            icon: Icons.Delete,
            isPending: deleteOds.isPending,
            text: 'Delete',
            title: 'Delete ODS',
            confirmBody: 'This will permanently delete the ODS.',
            onClick: () =>
              deleteOds.mutateAsync(
                { id: ods.id },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner }),
                  onSuccess: () =>
                    odsId &&
                    navigate(
                      `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/odss`
                    ),
                }
              ),
            confirm: true,
          },
        }
      : {}),
  };
};
