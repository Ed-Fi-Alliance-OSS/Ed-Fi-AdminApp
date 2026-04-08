import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { odsQueries } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useSyncEdOrgsAction = (): ActionsType => {
  const params = useParams() as { odsId: string };
  const { edfiTenant, sbEnvironment, teamId } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();

  const syncEdOrgs = odsQueries.syncEdOrgs({ edfiTenant, teamId });

  if (sbEnvironment.configPublic?.version !== 'v2') {
    return {};
  }

  return {
    SyncEdOrgs: {
      icon: Icons.Refresh,
      text: 'Sync Ed-Orgs',
      title: 'Sync education organizations from Admin API',
      isPending: syncEdOrgs.isPending,
      onClick: () =>
        syncEdOrgs.mutateAsync(
          { entity: {}, pathParams: { odsId: params.odsId } },
          {
            ...mutationErrCallback({ popGlobalBanner: popBanner }),
            onSuccess: () => popBanner({ title: 'Ed-Orgs synced successfully', type: 'Success' }),
          }
        ),
    },
  };
};
