import { useNavigate } from 'react-router-dom';
import { ActionsType } from '@edanalytics/common-ui';
import { BiPlus } from 'react-icons/bi';
import { GetIntegrationProviderDto } from '@edanalytics/models';
import { paths } from '../../routes/paths';
import { globalUserAuthConfig, useAuthorize } from '../../helpers';

export const useManyIntegrationProvidersGlobalActions = (
  provider?: GetIntegrationProviderDto
): ActionsType => {
  const navigate = useNavigate();

  const canCreate = useAuthorize(globalUserAuthConfig('integration-provider:create'));

  const createAction: ActionsType = canCreate
    ? {
        Create: {
          icon: BiPlus,
          text: 'Create new',
          title: 'Create new integration provider.',
          to: paths.integrationProvider.create,
          onClick: () => navigate(paths.integrationProvider.create),
        },
      }
    : {};

  return {
    ...createAction,
  };
};
