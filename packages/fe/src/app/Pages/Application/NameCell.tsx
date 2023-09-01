import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetApplicationDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';

import { applicationQueries } from '../../api';
import { ApplicationLink } from '../../routes';
import { useApplicationActions } from './useApplicationActions';

export const NameCell = (params: { asId: string | number; sbeId: string | number }) => {
  const Component = (info: CellContext<GetApplicationDto, unknown>) => {
    const entities = applicationQueries.useAll({
      tenantId: params.asId,
      sbeId: params.sbeId,
    });
    const actions = useApplicationActions({
      application: info.row.original,
      sbeId: String(params.sbeId),
      tenantId: String(params.asId),
    });
    return (
      <HStack justify="space-between">
        <ApplicationLink id={info.row.original.id} query={entities} />
        <TableRowActions actions={actions} />
      </HStack>
    );
  };
  return Component;
};
