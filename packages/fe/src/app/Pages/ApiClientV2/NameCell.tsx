import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetApiClientDtoV2 } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { useSingleApiClientActions } from './useApiClientActions';
import { ApiClientLinkV2 } from '../../routes/apiclients.routes';

export const NameCell = (
  info: CellContext<GetApiClientDtoV2, unknown>
) => {
  const actions = useSingleApiClientActions({
    apiClient: info.row.original,
    applicationId: info.row.original.applicationId,
  });
  return (
    <HStack justify="space-between">
      <ApiClientLinkV2 id={info.row.original.id} applicationId={info.row.original.applicationId} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
