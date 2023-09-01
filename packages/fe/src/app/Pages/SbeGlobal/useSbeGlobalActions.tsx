import { Link, Spinner, useBoolean } from '@chakra-ui/react';
import {
  ActionProps,
  ActionPropsConfirm,
  ActionsType,
  LinkActionProps,
  useOperationResultDisclosure,
} from '@edanalytics/common-ui';
import { GetSbeDto, PgBossJobState } from '@edanalytics/models';
import { StatusType } from '@edanalytics/utils';
import { BiCog, BiData, BiDownload, BiPlug, BiRename, BiShieldPlus, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { sbeQueries, useSbeCheckAdminAPI, useSbeRefreshResources } from '../../api';
import { AuthorizeComponent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';

export const useSbeGlobalActions = (sbe: GetSbeDto | undefined): ActionsType => {
  const checkAdminApi = useSbeCheckAdminAPI();
  const [checkLoading, setCheckLoading] = useBoolean(false);

  const refreshResources = useSbeRefreshResources();
  const [refreshLoading, setRefreshLoading] = useBoolean(false);

  const deleteSbe = sbeQueries.useDelete({});
  const searchParams = useSearchParamsObject();
  const edit = 'edit' in searchParams ? searchParams.edit : undefined;
  const syncDisclosure = useOperationResultDisclosure();
  const connectionCheckDisclosure = useOperationResultDisclosure();

  const popBanner = usePopBanner();

  const navigate = useNavigate();
  return sbe === undefined
    ? {}
    : {
        GrantOwnership: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const to = `/ownerships/create?sbeId=${sbe.id}&type=sbe`;
          return (
            <AuthorizeComponent
              config={{
                privilege: 'ownership:create',
                subject: {
                  id: '__filtered__',
                },
              }}
            >
              <props.children
                icon={BiShieldPlus}
                text="Grant ownership"
                title={'Grant ownership of ' + sbe.displayName}
                to={to}
                onClick={() => navigate(to)}
              />
            </AuthorizeComponent>
          );
        },
        View: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const to = `/sbes/${sbe.id}`;
          return (
            <AuthorizeComponent
              config={{
                privilege: 'sbe:read',
                subject: {
                  id: sbe.id,
                },
              }}
            >
              <props.children
                icon={HiOutlineEye}
                text="View"
                title={'View ' + sbe.displayName}
                to={to}
                onClick={() => navigate(to)}
              />
            </AuthorizeComponent>
          );
        },
        CheckConnection: (props: { children: (props: ActionProps) => JSX.Element }) => {
          return (
            <>
              <connectionCheckDisclosure.ModalRoot />
              <AuthorizeComponent
                config={{
                  privilege: 'sbe:read',
                  subject: {
                    id: sbe.id,
                  },
                }}
              >
                <props.children
                  icon={BiPlug}
                  isLoading={checkAdminApi.isLoading}
                  text="Ping Admin API"
                  title="Check connection to Ed-Fi Admin API"
                  onClick={async () => {
                    checkAdminApi.mutateAsync(sbe, {
                      ...mutationErrCallback({ popBanner }),
                      onSuccess: (res) => popBanner(res),
                    });
                  }}
                />
              </AuthorizeComponent>
            </>
          );
        },
        RefreshResources: (props: { children: (props: ActionProps) => JSX.Element }) => {
          return (
            <>
              <syncDisclosure.ModalRoot />
              <AuthorizeComponent
                config={{
                  privilege: 'sbe:refresh-resources',
                  subject: {
                    id: sbe.id,
                  },
                }}
              >
                <props.children
                  icon={BiDownload}
                  isLoading={refreshResources.isLoading}
                  text="Sync with SB"
                  title="Sync ODSs and Ed-Orgs from Starting Blocks to SBAA."
                  onClick={async () => {
                    await refreshResources.mutateAsync(sbe, {
                      ...mutationErrCallback({ popBanner }),
                      onSuccess(result, variables, context) {
                        const failureStates: PgBossJobState[] = ['failed', 'cancelled', 'expired'];
                        const pendingStates: PgBossJobState[] = ['created', 'retry', 'active'];
                        popBanner({
                          status:
                            result.state === 'completed'
                              ? StatusType.success
                              : failureStates.includes(result.state)
                              ? StatusType.error
                              : StatusType.info,
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
                  }}
                />
              </AuthorizeComponent>
            </>
          );
        },
        EditSbMeta: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const to = `/sbes/${sbe.id}?edit=sbe-meta`;
          return (
            <AuthorizeComponent
              config={{
                privilege: 'sbe:update',
                subject: {
                  id: sbe.id,
                },
              }}
            >
              <props.children
                isDisabled={edit === 'sbe-meta'}
                icon={BiData}
                text="Connect SB Meta"
                title="Setup connection to Starting Blocks metadata API"
                to={to}
                onClick={() => navigate(to)}
              />
            </AuthorizeComponent>
          );
        },
        RegisterAdminApi: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const to = `/sbes/${sbe.id}?edit=admin-api`;
          return (
            <AuthorizeComponent
              config={{
                privilege: 'sbe:update',
                subject: {
                  id: sbe.id,
                },
              }}
            >
              <props.children
                isDisabled={edit === 'admin-api'}
                icon={BiCog}
                text="Connect Admin API"
                title="Setup connection to Ed-Fi Admin API"
                to={to}
                onClick={() => navigate(to)}
              />
            </AuthorizeComponent>
          );
        },
        Rename: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const to = `/sbes/${sbe.id}?edit=name`;
          return (
            <AuthorizeComponent
              config={{
                privilege: 'sbe:update',
                subject: {
                  id: sbe.id,
                },
              }}
            >
              <props.children
                isDisabled={edit === 'name'}
                icon={BiRename}
                text="Rename"
                title="Rename the environment"
                to={to}
                onClick={() => navigate(to)}
              />
            </AuthorizeComponent>
          );
        },
        Delete: (props: { children: (props: ActionPropsConfirm) => JSX.Element }) => {
          return (
            <AuthorizeComponent
              config={{
                privilege: 'sbe:update',
                subject: {
                  id: sbe.id,
                },
              }}
            >
              <props.children
                icon={BiTrash}
                isLoading={deleteSbe.isLoading}
                text="Delete"
                title="Delete environment"
                confirmBody="This will permanently delete the environment."
                onClick={() =>
                  deleteSbe.mutateAsync(sbe.id, {
                    ...mutationErrCallback({ popBanner }),
                    onSuccess: () => navigate(`/sbes`),
                  })
                }
                confirm={true}
              />
            </AuthorizeComponent>
          );
        },
      };
};
