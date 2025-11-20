import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetIntegrationProviderDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { IntegrationProviderLink } from './IntegrationProviderLink';
import { useOneIntegrationProviderGlobalActions } from './useOneIntegrationProviderGlobalActions';

export const IntegrationProviderNameCell = (
  info: CellContext<GetIntegrationProviderDto, unknown>
) => {
  const actions = useOneIntegrationProviderGlobalActions(info.row.original);
  return (
    <HStack justify="space-between">
      <IntegrationProviderLink id={info.row.original.id} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
