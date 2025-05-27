import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetIntegrationAppDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';

import { IntegrationAppLink } from './IntegrationAppLink';
import { useOneIntegrationAppActions } from './useOneIntegrationAppActions';

export const IntegrationAppNameCell = (info: CellContext<GetIntegrationAppDto, unknown>) => {
  const integrationApp = info.row.original;

  const actions = useOneIntegrationAppActions(integrationApp);

  return (
    <HStack justify="space-between">
      <IntegrationAppLink integrationApp={integrationApp} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
