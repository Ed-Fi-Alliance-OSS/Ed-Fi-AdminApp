import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetApplicationDtoV2, GetIntegrationAppDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';

import { useQuery } from '@tanstack/react-query';
import { applicationQueriesV2 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { ApplicationLinkV2 } from '../../routes';
import { useSingleApplicationActions } from './useApplicationActions';

export const NameCell = (
  info: CellContext<GetApplicationDtoV2 & GetIntegrationAppDto, unknown>
) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const entities = useQuery(
    applicationQueriesV2.getAll({
      teamId,
      edfiTenant,
    })
  );
  const actions = useSingleApplicationActions({
    application: info.row.original,
  });
  return (
    <HStack justify="space-between">
      <ApplicationLinkV2 id={info.row.original.id} query={entities} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
