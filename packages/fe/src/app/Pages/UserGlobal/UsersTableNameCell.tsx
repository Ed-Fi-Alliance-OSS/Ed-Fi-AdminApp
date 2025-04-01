import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetUserDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { UserGlobalLink } from '../../routes';
import { useUserGlobalActions } from './useUserGlobalActions';

export const UsersTableNameCell = (info: CellContext<GetUserDto, unknown>) => {
  const actions = useUserGlobalActions(info.row.original);
  return (
    <HStack justify="space-between">
      <UserGlobalLink id={info.row.original.id} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
