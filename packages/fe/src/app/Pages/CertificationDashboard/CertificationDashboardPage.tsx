import {
  Box,
  Heading,
  SimpleGrid,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import {
  CertificationDashboardListDto,
  CertificationDashboardRunDto,
  CertRunStatus,
} from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { AuthorizeConfig, authorize, usePrivilegeCacheForConfig } from '../../helpers';
import { formatWaiting } from './formatWaiting';
import { useCertificationDashboard } from './useCertificationDashboard';

const TITLE = 'Certification dashboard';
const EMPTY = '—';

const STATUS_LABELS: Record<CertRunStatus, string> = {
  DRAFT: 'Draft',
  READY_FOR_REVIEW: 'Ready for review',
  IN_REVIEW: 'In review',
  CHANGES_REQUESTED: 'Changes requested',
  READY_FOR_REVIEW_WITH_CHANGES: 'Ready for review with new changes',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const READ_CERTIFICATION: AuthorizeConfig = {
  privilege: 'certification:read',
  subject: { id: '__filtered__' },
};

export const CertificationDashboardPage = () => {
  const queryClient = useQueryClient();
  // Until the privilege cache arrives authorize() is false, which must not read as "not allowed".
  const privilegeCache = usePrivilegeCacheForConfig(READ_CERTIFICATION);
  const canRead = authorize({ queryClient, config: READ_CERTIFICATION });
  const { data, error, isLoading, dataUpdatedAt } = useCertificationDashboard(canRead);

  if (privilegeCache.some((cache) => cache.isLoading)) {
    return (
      <PageTemplate title={TITLE}>
        <Spinner />
      </PageTemplate>
    );
  }

  if (!canRead) {
    // Caught by the route errorElement (ErrorFallback), which displays the message.
    throw new Error('Not allowed');
  }

  if (error) {
    // A failed request is not a denial: show the real error, not "Not allowed".
    throw error;
  }

  if (isLoading || !data) {
    return (
      <PageTemplate title={TITLE}>
        <Spinner />
      </PageTemplate>
    );
  }

  const { counts, waiting, others } = data;
  const cards = [
    { label: 'Newly Ready for Review', value: counts.newlyReadyForReview },
    { label: 'Ready for review with new changes', value: counts.readyWithNewChanges },
    { label: 'Picked up', value: counts.pickedUp },
    { label: 'Runs in flight', value: counts.runsInFlight },
  ];

  return (
    <PageTemplate title={TITLE}>
      <Text color="gray.600" mb={4}>
        Accurate as of page load — {new Date(dataUpdatedAt).toLocaleString()}
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4} mb={6}>
        {cards.map(({ label, value }) => (
          <Box key={label} borderWidth="1px" borderRadius="md" p={4} bg="background-bg">
            <Stat>
              <StatLabel>{label}</StatLabel>
              <StatNumber>{value}</StatNumber>
            </Stat>
          </Box>
        ))}
      </SimpleGrid>

      <RunsCard
        title="Waiting for review"
        list={waiting}
        timeColumn="Waiting"
        emptyMessage="Nothing is waiting for review"
      />
      <RunsCard title="Runs in flight or rejected" list={others} timeColumn="Last updated" />
    </PageTemplate>
  );
};

const RunsCard = ({
  title,
  list,
  timeColumn,
  emptyMessage,
}: {
  title: string;
  list: CertificationDashboardListDto;
  timeColumn: 'Waiting' | 'Last updated';
  emptyMessage?: string;
}) => (
  <Box borderWidth="1px" borderRadius="md" p={4} mb={6} bg="background-bg">
    <Heading as="h2" size="sm" mb={3}>
      {title}
    </Heading>
    {list.total === 0 && emptyMessage && <Text color="gray.600">{emptyMessage}</Text>}
    {list.rows.length > 0 && (
      <TableContainer>
        <Table size="sm" aria-label={title}>
          <Thead>
            <Tr>
              <Th>Team</Th>
              <Th>Data store</Th>
              <Th>Certification Model</Th>
              <Th>Status</Th>
              <Th>{timeColumn}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {list.rows.map((row) => (
              <RunRow key={row.runId} row={row} timeColumn={timeColumn} />
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    )}
    {list.total > list.rows.length && (
      <Text color="gray.600" fontSize="sm" mt={2}>
        Showing {list.rows.length} of {list.total}
      </Text>
    )}
  </Box>
);

const RunRow = ({
  row,
  timeColumn,
}: {
  row: CertificationDashboardRunDto;
  timeColumn: 'Waiting' | 'Last updated';
}) => (
  <Tr>
    <Td>{row.teamName ?? EMPTY}</Td>
    <Td>{row.dataStore ?? `${row.sbEnvironmentName} / ${row.edfiTenantName}`}</Td>
    <Td>{row.certificationModel}</Td>
    <Td>{STATUS_LABELS[row.status]}</Td>
    <Td>
      {timeColumn === 'Waiting'
        ? formatWaiting(row.statusChangedAt)
        : new Date(row.updatedAt).toLocaleString()}
    </Td>
  </Tr>
);
