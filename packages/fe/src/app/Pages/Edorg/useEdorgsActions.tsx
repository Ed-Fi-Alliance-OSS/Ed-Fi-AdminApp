import { ActionsType, Icons } from '@edanalytics/common-ui';
import { useNavigate } from 'react-router-dom';
import {
  teamEdfiTenantAuthConfig,
  useAuthorize,
  useTeamSbEnvironmentNavContext,
} from '../../helpers';
import { GetOdsDto } from '@edanalytics/models';

export const useEdorgsActions = ({ ods }: { ods?: GetOdsDto }): ActionsType => {
  const navigate = useNavigate();
  const { edfiTenantId, sbEnvironmentId, sbEnvironment, teamId } = useTeamSbEnvironmentNavContext();

  const createEdorgUrl = `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/edorgs/create${
    ods?.odsInstanceName ? `?ODSName=${ods.odsInstanceName}` : ''
  }`;
  const displayOptions = sbEnvironment?.startingBlocks;
  const canPost =
    useAuthorize(
      teamEdfiTenantAuthConfig(
        '__filtered__',
        edfiTenantId,
        teamId,
        'team.sb-environment.edfi-tenant.ods:create-edorg'
      )
    ) && sbEnvironment?.version === 'v2';
  return displayOptions && canPost
    ? {
        Create: {
          icon: Icons.Plus,
          text: 'Create',
          title: 'Create new ed-org.',
          to: createEdorgUrl,
          onClick: () => edfiTenantId !== undefined && navigate(createEdorgUrl),
        },
      }
    : {};
};
