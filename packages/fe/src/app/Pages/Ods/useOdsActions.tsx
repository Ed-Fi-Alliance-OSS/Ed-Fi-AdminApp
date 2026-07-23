import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetOdsDto } from '@edanalytics/models';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { dbInstancesV2, odsQueries } from '../../api';
import {
  teamEdfiTenantAuthConfig,
  useAuthorize,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useOdsActions = (ods: Pick<GetOdsDto, 'id' | 'dbInstanceId' | 'status'>): ActionsType => {
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
  const deleteDbInstance = dbInstancesV2.delete({ edfiTenant, teamId });
  const isStartingBlocks = sbEnvironment.startingBlocks;
  const canDeleteDbInstance =
    typeof ods.dbInstanceId === 'number' && ods.dbInstanceId > 0 && ods.status === 'Created';
  const deleteMutation = isStartingBlocks ? deleteOds : canDeleteDbInstance ? deleteDbInstance : undefined;
  const deleteId = isStartingBlocks ? ods.id : ods.dbInstanceId;

  return {
    ...(canDelete && deleteMutation && typeof deleteId === 'number'
      ? {
          Delete: {
            icon: Icons.Delete,
            isPending: deleteMutation.isPending,
            text: 'Delete',
            title: 'Delete ODS',
            confirmBody: 'This will permanently delete the ODS.',
            onClick: () =>
              deleteMutation.mutateAsync(
                { id: deleteId },
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
