import { useQuery } from '@tanstack/react-query';
import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetUserTeamMembershipDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { userTeamMembershipQueries } from '../../api';
import { UtmGlobalLink } from '../../routes';
import { useUtmActionsGlobal } from './useUtmActionsGlobal';

export const UtmGlobalNameCell = (info: CellContext<GetUserTeamMembershipDto, unknown>) => {
  const userTeamMemberships = useQuery(userTeamMembershipQueries.getAll({}));
  const actions = useUtmActionsGlobal(info.row.original);
  return (
    <HStack justify="space-between">
      <UtmGlobalLink id={info.row.original.id} query={userTeamMemberships} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
