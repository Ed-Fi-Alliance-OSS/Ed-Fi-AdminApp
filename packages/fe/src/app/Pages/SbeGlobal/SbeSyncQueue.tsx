import {
  Badge,
  Box,
  Link,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Text,
  chakra,
} from '@chakra-ui/react';
import { ContentSection, DateFormat, SbaaTableAllInOne, ValueAsDate } from '@edanalytics/common-ui';
import { GetSbeDto } from '@edanalytics/models';
import dayjs from 'dayjs';
import sortBy from 'lodash/sortBy';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { sbSyncQueueQueries } from '../../api';
import { jobStateColorSchemes } from '../SbSyncQueue/SbSyncQueuesPage';

export const SbeSyncQueue = (props: { sbe: GetSbeDto }) => {
  const sbSyncQueues = sbSyncQueueQueries.useAll({});
  const filteredQueues = useMemo(
    () =>
      sortBy(
        Object.values(sbSyncQueues.data ?? {}).filter((q) => q.sbeId === props.sbe.id),
        ['createdOnNumber']
      ).reverse(),
    [sbSyncQueues, props.sbe.id]
  );

  return (
    <ContentSection heading="Sync queue">
      <SbaaTableAllInOne
        data={filteredQueues}
        columns={[
          {
            id: 'link',
            cell: (info) => (
              <Link as={RouterLink} to={`/sb-sync-queues/${info.row.original.id}`}>
                View
              </Link>
            ),
            header: 'Item',
            enableColumnFilter: false,
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
            accessorKey: 'completedOnNumber',
            cell: ValueAsDate(),
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
                        boxShadow="lg"
                        w="auto"
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
                            <chakra.pre fontSize="sm" whiteSpace="break-spaces">
                              {info.getValue() as string}
                            </chakra.pre>
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
        ]}
      />
    </ContentSection>
  );
};
