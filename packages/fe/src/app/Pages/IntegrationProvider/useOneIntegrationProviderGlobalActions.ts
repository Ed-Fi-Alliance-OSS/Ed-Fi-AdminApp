import { ActionsType } from '@edanalytics/common-ui';
import { GetIntegrationProviderDto } from '@edanalytics/models';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { globalUserAuthConfig, useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { useQueryClient } from '@tanstack/react-query';
import { paths } from '../../routes/paths';
import { useDeleteIntegrationProvider, QUERY_KEYS } from '../../api-v2';

export const useOneIntegrationProviderGlobalActions = (
  integrationProvider: GetIntegrationProviderDto | undefined
): ActionsType => {
  const location = useLocation();
  const search = useSearchParamsObject();
  const navigate = useNavigate();
  const popGlobalBanner = usePopBanner();
  const queryClient = useQueryClient();

  const { mutate: deleteIntegrationProvider } = useDeleteIntegrationProvider();

  const canView = useAuthorize(globalUserAuthConfig('integration-provider:read'));
  const canEdit = useAuthorize(globalUserAuthConfig('integration-provider:update'));
  const canDelete = useAuthorize(globalUserAuthConfig('integration-provider:delete'));

  if (!integrationProvider) {
    return {};
  }

  const onPage =
    integrationProvider &&
    location.pathname.endsWith(paths.integrationProvider.id(integrationProvider.id));
  const inEdit = onPage && 'edit' in search && search?.edit === 'true';

  const onDeleteClick = () => {
    deleteIntegrationProvider(integrationProvider.id, {
      ...mutationErrCallback({ popGlobalBanner }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.integrationProviders] });
        navigate(paths.integrationProvider.index);
      },
    });
  };

  const viewAction: ActionsType = canView
    ? {
        View: {
          icon: HiOutlineEye,
          text: 'View',
          title: 'View ' + integrationProvider.name,
          to: paths.integrationProvider.id(integrationProvider.id),
          onClick: () => navigate(paths.integrationProvider.id(integrationProvider.id)),
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
          to: paths.integrationProvider.edit(integrationProvider.id),
          onClick: () => navigate(paths.integrationProvider.edit(integrationProvider.id)),
        },
      }
    : {};

  const deleteAction: ActionsType = canDelete
    ? {
        Delete: {
          icon: BiTrash,
          text: 'Delete',
          title: 'Delete ' + integrationProvider.name,
          confirmBody: 'This will permanently delete the integration provider.',
          confirm: true,
          onClick: onDeleteClick,
        },
      }
    : {};

  return {
    ...viewAction,
    ...editAction,
    ...deleteAction,
  };
};
