import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { CellContext } from '@tanstack/react-table';
import { profileQueriesV2 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { ProfileLink } from '../../routes';
import { useProfileActions } from './useProfileActions';
import { GetProfileDtoV2 } from '@edanalytics/models';

export const NameCell = (info: CellContext<GetProfileDtoV2, unknown>) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const entities = useQuery(
    profileQueriesV2.getAll({
      teamId,
      edfiTenant,
    })
  );

  const actions = useProfileActions(info.row.original);
  return (
    <HStack justify="space-between">
      <ProfileLink id={info.row.original.id} query={entities} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
