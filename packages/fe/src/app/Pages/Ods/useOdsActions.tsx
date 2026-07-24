import { ActionsType, Icons } from '@edanalytics/common-ui';
import { GetOdsDto } from '@edanalytics/models';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { dbInstancesV2, odsQueries } from '../../api';
import {
  teamEdfiTenantAuthConfig,
  useAuthorize,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const withPendingDeleteStatus = <T extends { status: string | null }>(value: T): T =>
  Object.assign(Object.create(Object.getPrototypeOf(value)), value, { status: 'PendingDelete' });

export const useOdsActions = (ods: Pick<GetOdsDto, 'id' | 'dbInstanceId' | 'status'>): ActionsType => {
  const navigate = useNavigate();
  const { edfiTenantId, edfiTenant, sbEnvironmentId, sbEnvironment, teamId } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();
  const { odsId } = useParams();
  const queryClient = useQueryClient();

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

  const applyPendingDeleteOptimistic = () => {
    queryClient.setQueryData<Record<number, GetOdsDto>>(
      odsQueries.getAll({ edfiTenant, teamId }).queryKey,
      (prev) => {
        if (!prev) return prev;
        const current = prev[ods.id];
        if (!current) return prev;
        return { ...prev, [ods.id]: withPendingDeleteStatus(current) };
      }
    );
    queryClient.setQueryData<GetOdsDto>(
      odsQueries.getOne({ id: ods.id, edfiTenant, teamId }).queryKey,
      (prev) => (prev ? withPendingDeleteStatus(prev) : prev)
    );
  };

  return {
    ...(canDelete && deleteMutation && typeof deleteId === 'number'
      ? {
          Delete: {
            icon: Icons.Delete,
            isPending: deleteMutation.isPending,
            text: 'Delete',
            title: 'Delete ODS',
            confirmBody: 'This will permanently delete the ODS.',
            onClick: () => {
              if (!isStartingBlocks) applyPendingDeleteOptimistic();
              return deleteMutation.mutateAsync(
                { id: deleteId },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner }),
                  onSuccess: () =>
                    odsId &&
                    navigate(
                      `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/odss`
                    ),
                }
              );
            },
            confirm: true,
          },
        }
      : {}),
  };
};