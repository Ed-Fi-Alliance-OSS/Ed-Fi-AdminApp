import { Spinner, useBoolean } from '@chakra-ui/react';
import { useOperationResultDisclosure } from '@edanalytics/common-ui';
import { GetSbeDto } from '@edanalytics/models';
import { BiCog, BiData, BiDownload, BiKey, BiPlug, BiShieldPlus, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import {
  sbeQueries,
  useSbeCheckAdminAPI,
  useSbeCheckSbMeta,
  useSbeRefreshResources,
} from '../../api';
import { AuthorizeComponent } from '../../helpers';
import {
  ActionProps,
  ActionPropsConfirm,
  ActionsType,
  LinkActionProps,
} from '../../helpers/ActionsType';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useSbeGlobalActions = (sbe: GetSbeDto | undefined): ActionsType => {
  const checkAdminApi = useSbeCheckAdminAPI();
  const checkSbMeta = useSbeCheckSbMeta();
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
                  icon={() => (checkLoading ? <Spinner size="sm" /> : <BiPlug />)}
                  text="Check connection"
                  title="Check connection to Starting Blocks and Ed-Fi Admin API"
                  onClick={async () => {
                    setCheckLoading.on();
                    Promise.all([
                      checkAdminApi.mutateAsync(sbe, {
                        onSuccess: (res) => popBanner(res),
                        ...mutationErrCallback({ popBanner }),
                      }),
                      checkSbMeta.mutateAsync(sbe, {
                        onSuccess: (res) => popBanner(res),
                        ...mutationErrCallback({ popBanner }),
                      }),
                    ]).finally(() => setCheckLoading.off());
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
                  icon={() => (refreshLoading ? <Spinner size="sm" /> : <BiDownload />)}
                  text="Sync with SB"
                  title="Sync ODSs and Ed-Orgs from Starting Blocks to SBAA."
                  onClick={async () => {
                    setRefreshLoading.on();
                    await refreshResources.mutateAsync(sbe).finally(() => setRefreshLoading.off());
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
                text="Delete"
                title="Delete environment"
                confirmBody="This will permanently delete the environment."
                onClick={() =>
                  deleteSbe.mutateAsync(sbe.id, {
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
