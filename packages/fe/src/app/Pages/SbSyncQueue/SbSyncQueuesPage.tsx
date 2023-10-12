import {
  Badge,
  Box,
  HStack,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Text,
  chakra,
} from '@chakra-ui/react';
import {
  DateFormat,
  PageActions,
  PageTemplate,
  SbaaTableAllInOne,
  TableRowActions,
  ValueAsDate,
} from '@edanalytics/common-ui';
import { PgBossJobState, SbSyncQueueDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import dayjs from 'dayjs';
import sortBy from 'lodash/sortBy';
import { useMemo } from 'react';
import { sbSyncQueueQueries, sbeQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { SbSyncQueueLink, SbeGlobalLink } from '../../routes';
import { useSbSyncQueueActions } from './useSbSyncQueueActions';
import { useSbSyncQueuesActions } from './useSbSyncQueuesActions';

export const jobStateColorSchemes: Record<PgBossJobState, string> = {
  active: 'purple',
  cancelled: 'orange',
  completed: 'green',
  created: 'blue',
  expired: 'orange',
  failed: 'red',
  retry: 'yellow',
};

const SbSyncQueueNameCell = (info: CellContext<SbSyncQueueDto, unknown>) => {
  const sbSyncQueues = sbSyncQueueQueries.useAll({});
  const actions = useSbSyncQueueActions(info.row.original);
  return (
    <HStack justify="space-between">
      <SbSyncQueueLink id={info.row.original.id} query={sbSyncQueues} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};

export const SbSyncQueuesPage = () => {
  const sbSyncQueues = sbSyncQueueQueries.useAll({});
  const data = useMemo(
    () => sortBy(Object.values(sbSyncQueues?.data || {}), ['createdOnNumber']).reverse(),
    [sbSyncQueues.data]
  );
  const actions = useSbSyncQueuesActions();
  const sbes = sbeQueries.useAll({});

  return (
    <PageTemplate title="SB Environment Sync" actions={<PageActions actions={actions} />}>
      <SbaaTableAllInOne
        data={data}
        columns={[
          {
            accessorKey: 'displayName',
            cell: SbSyncQueueNameCell,
            header: 'Name',
            enableColumnFilter: false,
          },
          {
            id: 'sbe',
            accessorFn: (info) => getRelationDisplayName(info.sbeId, sbes),
            header: 'Environment',
            cell: (info) => <SbeGlobalLink query={sbes} id={info.row.original.sbeId} />,
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            accessorKey: 'state',
            header: 'State',
            cell: (info) => (
              <Badge colorScheme={jobStateColorSchemes[info.row.original.state]}>
                {info.row.original.state}
              </Badge>
            ),
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            enableColumnFilter: false,
            enableGlobalFilter: false,
            id: 'output',
            accessorFn: (info) =>
              info.output === null ? null : JSON.stringify(info.output, null, 2),
            cell: (info) =>
              info.getValue() ? (
                <Popover trigger="hover" autoFocus={false}>
                  {({ isOpen, onClose }) => (
                    <>
                      <PopoverTrigger>
                        <Text
                          as="button"
                          textOverflow="ellipsis"
                          whiteSpace="nowrap"
                          overflow="hidden"
                          maxW="9em"
                        >
                          {info.getValue() as string}
                        </Text>
                      </PopoverTrigger>
                      <PopoverContent
                        w="auto"
                        boxShadow="lg"
                        display={!isOpen ? 'none' : undefined}
                      >
                        <PopoverArrow />
                        <PopoverBody borderRadius="md" p="unset" overflow="clip">
                          <Box
                            overflow="auto"
                            minH="7rem"
                            maxH="30rem"
                            minW="30rem"
                            maxW="50rem"
                            w="auto"
                            p={2}
                          >
                            <chakra.pre fontSize="sm">{info.getValue() as string}</chakra.pre>
                          </Box>
                        </PopoverBody>
                      </PopoverContent>
                    </>
                  )}
                </Popover>
              ) : null,
            header: 'Output',
            enableSorting: false,
          },
          {
            accessorKey: 'createdOnNumber',
            cell: ValueAsDate({ default: DateFormat.Long }),
            header: 'Created',
            meta: {
              type: 'date',
            },
          },
          {
            id: 'completedon',
            accessorKey: 'completedOnNumber',
            cell: ValueAsDate({ default: DateFormat.Long }),
            header: 'Completed',
            meta: {
              type: 'date',
            },
          },
          {
            id: 'duration',
            accessorFn: (info) =>
              info.completedon && info.createdon
                ? dayjs(info.completedon).diff(info.createdon) / 1000
                : null,
            cell: (info) => info.row.original.durationDetailed,
            header: 'Duration',
            meta: {
              type: 'duration',
            },
          },
        ]}
      />
    </PageTemplate>
  );
};
