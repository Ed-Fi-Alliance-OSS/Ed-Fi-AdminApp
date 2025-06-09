import { ActionsType } from '@edanalytics/common-ui';
import { GetIntegrationProviderDto, OWNERSHIP_RESOURCE_TYPE } from '@edanalytics/models';
import { BiEdit, BiShieldPlus, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import {
  globalOwnershipAuthConfig,
  globalUserAuthConfig,
  useAuthorize,
  useNavContext,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { useQueryClient } from '@tanstack/react-query';
import { usePaths } from '../../routes/paths';
import { useDeleteIntegrationProvider, QUERY_KEYS, useGetManyIntegrationApps } from '../../api-v2';

export const useOneIntegrationProviderGlobalActions = (
  integrationProvider: GetIntegrationProviderDto | undefined
): ActionsType => {
  const location = useLocation();
  const search = useSearchParamsObject();
  const navigate = useNavigate();
  const popGlobalBanner = usePopBanner();
  const queryClient = useQueryClient();

  const { mutate: deleteIntegrationProvider } = useDeleteIntegrationProvider();

  const { asId: teamId } = useNavContext();
  const inTeamScope = !!teamId;

  const paths = usePaths();

  const canGrantOwnership =
    useAuthorize(globalOwnershipAuthConfig('ownership:create')) && !inTeamScope;
  const canView = useAuthorize(globalUserAuthConfig('integration-provider:read'));
  const canEdit = useAuthorize(globalUserAuthConfig('integration-provider:update')) && !inTeamScope;
  const canDelete =
    useAuthorize(globalUserAuthConfig('integration-provider:delete')) && !inTeamScope;

  if (!integrationProvider) {
    return {};
  }

  const hasIntegrationApps = (integrationProvider.appCount ?? 0) > 0;

  const integrationProviderId = integrationProvider.id;
  const onPage =
    integrationProvider &&
    location.pathname.endsWith(paths.integrationProvider.view({ integrationProviderId }));
  const inEdit = onPage && 'edit' in search && search?.edit === 'true';

  const onDeleteClick = () => {
    deleteIntegrationProvider(integrationProvider.id, {
      ...mutationErrCallback({ popGlobalBanner }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.integrationProviders] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ownerships] });
        navigate(paths.integrationProvider.index());
      },
    });
  };

  const ownershipAction: ActionsType = canGrantOwnership
    ? {
        GrantOwnership: {
          icon: BiShieldPlus,
          text: 'Grant ownership',
          title: 'Grant ownership of ' + integrationProvider.name,
          to: `/ownerships/create?integrationProviderId=${integrationProvider.id}&type=${OWNERSHIP_RESOURCE_TYPE.integrationProvider}`,
          onClick: () =>
            navigate(
              `/ownerships/create?integrationProviderId=${integrationProvider.id}&type=${OWNERSHIP_RESOURCE_TYPE.integrationProvider}`
            ),
        },
      }
    : {};

  const viewAction: ActionsType = canView
    ? {
        View: {
          icon: HiOutlineEye,
          text: 'View',
          title: 'View ' + integrationProvider.name,
          to: paths.integrationProvider.view({ integrationProviderId }),
          onClick: () => navigate(paths.integrationProvider.view({ integrationProviderId })),
        },
      }
    : {};

  const editAction: ActionsType = canEdit
    ? {
        Edit: {
          icon: BiEdit,
          isDisabled: inEdit,
          text: 'Edit',
          title: 'Edit ' + integrationProvider.name,
          to: paths.integrationProvider.edit({ integrationProviderId }),
          onClick: () => navigate(paths.integrationProvider.edit({ integrationProviderId })),
        },
      }
    : {};

  const deleteTitle = hasIntegrationApps
    ? 'This Integration Provider has integration apps and cannot be deleted.'
    : `Delete ${integrationProvider.name}`;
  const deleteAction: ActionsType = canDelete
    ? {
        Delete: {
          icon: BiTrash,
          text: 'Delete',
          title: deleteTitle,
          confirmBody: 'This will permanently delete the integration provider.',
          confirm: true,
          isDisabled: hasIntegrationApps,
          onClick: onDeleteClick,
        },
      }
    : {};

  return {
    ...ownershipAction,
    ...viewAction,
    ...editAction,
    ...deleteAction,
  };
};
