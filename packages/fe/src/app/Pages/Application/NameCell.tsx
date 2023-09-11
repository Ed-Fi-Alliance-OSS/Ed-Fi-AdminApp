import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetApplicationDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';

import { applicationQueries } from '../../api';
import { ApplicationLink } from '../../routes';
import { useSingleApplicationActions } from './useApplicationActions';
import { useNavContext } from '../../helpers';

export const NameCell = (info: CellContext<GetApplicationDto, unknown>) => {
  const params = useNavContext();
  const entities = applicationQueries.useAll({
    tenantId: params.asId!,
    sbeId: params.sbeId!,
  });
  const actions = useSingleApplicationActions({
    application: info.row.original,
    sbeId: String(params.sbeId!),
    tenantId: String(params.asId!),
  });
  return (
    <HStack justify="space-between">
      <ApplicationLink id={info.row.original.id} query={entities} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
