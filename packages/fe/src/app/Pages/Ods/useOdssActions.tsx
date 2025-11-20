import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useNavigate } from 'react-router-dom';
import {
  teamEdfiTenantAuthConfig,
  useAuthorize,
  useTeamSbEnvironmentNavContext,
} from '../../helpers';

export const useOdssActions = (): ActionsType => {
  const navigate = useNavigate();
  const { edfiTenantId, sbEnvironmentId, teamId } = useTeamSbEnvironmentNavContext();

  const canPost = useAuthorize(
    teamEdfiTenantAuthConfig(
      '__filtered__',
      edfiTenantId,
      teamId,
      'team.sb-environment.edfi-tenant:create-ods'
    )
  );
  return canPost
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'Create',
          title: 'Create new ODS.',
          to: `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/odss/create`,
          onClick: () =>
            edfiTenantId !== undefined &&
            navigate(
              `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/odss/create`
            ),
        },
      }
    : {};
};
