import { Link } from '@chakra-ui/react';
import { ActionsType } from '@edanalytics/common-ui';
import { GetSbeDto, PgBossJobState } from '@edanalytics/models';
import { BiCog, BiData, BiDownload, BiPlug, BiRename, BiShieldPlus, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { sbeQueries, useSbeCheckAdminAPI, useSbeRefreshResources } from '../../api';
import { globalOwnershipAuthConfig, globalSbeAuthConfig, useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';

export const useSbeGlobalActions = (sbe: GetSbeDto | undefined): ActionsType => {
  const checkAdminApi = useSbeCheckAdminAPI();

  const refreshResources = useSbeRefreshResources();

  const deleteSbe = sbeQueries.useDelete({});
  const searchParams = useSearchParamsObject();
  const edit = 'edit' in searchParams ? searchParams.edit : undefined;

  const popBanner = usePopBanner();

  const navigate = useNavigate();

  const canGrantOwnership = useAuthorize(globalOwnershipAuthConfig('ownership:create'));
  const canView = useAuthorize(globalSbeAuthConfig(sbe?.id, 'sbe:read'));
  const canCheckConnection = useAuthorize(globalSbeAuthConfig(sbe?.id, 'sbe:read'));
  const canRefreshResources = useAuthorize(globalSbeAuthConfig(sbe?.id, 'sbe:refresh-resources'));
  const canEditSbMeta = useAuthorize(globalSbeAuthConfig(sbe?.id, 'sbe:update'));
  const canRegisterAdminApi = useAuthorize(globalSbeAuthConfig(sbe?.id, 'sbe:update'));
  const canRename = useAuthorize(globalSbeAuthConfig(sbe?.id, 'sbe:update'));
  const canDelete = useAuthorize(globalSbeAuthConfig(sbe?.id, 'sbe:delete'));

  return sbe === undefined
    ? {}
    : {
        ...(canGrantOwnership
          ? {
              GrantOwnership: {
                icon: BiShieldPlus,
                text: 'Grant ownership',
                title: 'Grant ownership of ' + sbe.displayName,
                to: `/ownerships/create?sbeId=${sbe.id}&type=sbe`,
                onClick: () => navigate(`/ownerships/create?sbeId=${sbe.id}&type=sbe`),
              },
            }
          : {}),
        ...(canView
          ? {
              View: {
                icon: HiOutlineEye,
                text: 'View',
                title: 'View ' + sbe.displayName,
                to: `/sbes/${sbe.id}`,
                onClick: () => navigate(`/sbes/${sbe.id}`),
              },
            }
          : {}),
        ...(canCheckConnection
          ? {
              CheckConnection: {
                icon: BiPlug,
                isLoading: checkAdminApi.isLoading,
                text: 'Ping Admin API',
                title: 'Check connection to Ed-Fi Admin API',
                onClick: async () => {
                  checkAdminApi.mutateAsync(sbe, {
                    ...mutationErrCallback({ popGlobalBanner: popBanner }),
                    onSuccess: (res) => popBanner(res),
                  });
                },
              },
            }
          : {}),
        ...(canRefreshResources
          ? {
              RefreshResources: {
                icon: BiDownload,
                isLoading: refreshResources.isLoading,
                text: 'Sync with SB',
                title: 'Sync ODSs and Ed-Orgs from Starting Blocks to SBAA.',
                onClick: async () => {
                  await refreshResources.mutateAsync(sbe, {
                    ...mutationErrCallback({ popGlobalBanner: popBanner }),
                    onSuccess(result, variables, context) {
                      const failureStates: PgBossJobState[] = ['failed', 'cancelled', 'expired'];
                      const pendingStates: PgBossJobState[] = ['created', 'retry', 'active'];
                      popBanner({
                        type:
                          result.state === 'completed'
                            ? 'Success'
                            : failureStates.includes(result.state)
                            ? 'Error'
                            : 'Info',
                        title: `Sync ${
                          result.state === 'completed'
                            ? 'completed'
                            : failureStates.includes(result.state)
                            ? 'failed'
                            : 'queued'
                        }`,
                        message: (
                          <>
                            See the queue item for more details
                            {pendingStates.includes(result.state)
                              ? ' and updated status'
                              : ''}:{' '}
                            <Link as={RouterLink} to={`/sb-sync-queues/${result.id}`}>
                              /sb-sync-queues/{result.id}
                            </Link>
                            .
                          </>
                        ),
                      });
                    },
                  });
                },
              },
            }
          : {}),
        ...(canEditSbMeta
          ? {
              EditSbMeta: {
                isDisabled: edit === 'sbe-meta',
                icon: BiData,
                text: 'Connect SB Meta',
                title: 'Setup connection to Starting Blocks metadata API',
                to: `/sbes/${sbe.id}?edit=sbe-meta`,
                onClick: () => navigate(`/sbes/${sbe.id}?edit=sbe-meta`),
              },
            }
          : {}),
        ...(canRegisterAdminApi
          ? {
              RegisterAdminApi: {
                isDisabled: edit === 'admin-api',
                icon: BiCog,
                text: 'Connect Admin API',
                title: 'Setup connection to Ed-Fi Admin API',
                to: `/sbes/${sbe.id}?edit=admin-api`,
                onClick: () => navigate(`/sbes/${sbe.id}?edit=admin-api`),
              },
            }
          : {}),
        ...(canRename
          ? {
              Rename: {
                isDisabled: edit === 'name',
                icon: BiRename,
                text: 'Rename',
                title: 'Rename the environment',
                to: `/sbes/${sbe.id}?edit=name`,
                onClick: () => navigate(`/sbes/${sbe.id}?edit=name`),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: BiTrash,
                isLoading: deleteSbe.isLoading,
                text: 'Delete',
                title: 'Delete environment',
                confirmBody: 'This will permanently delete the environment.',
                onClick: () =>
                  deleteSbe.mutateAsync(sbe.id, {
                    ...mutationErrCallback({ popGlobalBanner: popBanner }),
                    onSuccess: () => navigate(`/sbes`),
                  }),
                confirm: true,
              },
            }
          : {}),
      };
};
