import {
  Badge,
  Box,
  Button,
  Collapse,
  Heading,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { CERT_RUN_EVENT_LABELS, CERT_RUN_STATUS_LABELS } from '@edanalytics/models';
import { useId, useState } from 'react';
import { CERT_RUN_STATUS_COLOR } from './certificationRunStatus';
import { useCertificationRunEvents } from './useCertificationRunEvents';

const COLUMN_COUNT = 4;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * The append-only history of the run (AC-650): every status change, newest first, with who made
 * it. Reviewer comments aren't repeated here: they can be long and the Reviewer comments card on
 * the same page shows them. Read-only; nothing here edits an entry.
 */
export const CertificationRunAuditHistory = ({
  teamId,
  runId,
}: {
  teamId: number;
  runId: number;
}) => {
  const tableId = useId();
  const [isOpen, setIsOpen] = useState(true);
  const { events, hasMore, loadMore, isLoadingMore, isLoading, isError } =
    useCertificationRunEvents(teamId, runId);

  // Shown in place of the rows while there are none; loaded rows stay if a refresh fails.
  const placeholder =
    events.length > 0 ? null : isLoading ? (
      <Text color="gray.600">Loading history…</Text>
    ) : isError ? (
      <Text color="red.600">The audit history couldn't be loaded.</Text>
    ) : (
      <Text color="gray.600">No history yet.</Text>
    );

  return (
    <Box mt={6} p={4} border="1px solid" borderColor="gray.200" borderRadius="md" bg="gray.50">
      <Heading as="h2" fontSize="md" fontWeight="semibold" mb={isOpen ? 3 : 0}>
        <Button
          variant="unstyled"
          type="button"
          fontSize="inherit"
          fontWeight="inherit"
          height="auto"
          aria-expanded={isOpen}
          aria-controls={tableId}
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? '▾' : '▸'} Audit history
        </Button>
      </Heading>
      <Collapse in={isOpen} animateOpacity unmountOnExit>
        <Box id={tableId}>
          <Table size="sm" mt={0} aria-label="Audit history">
            <Thead>
              <Tr>
                <Th>Date</Th>
                <Th>Event</Th>
                <Th>Status</Th>
                <Th>By</Th>
              </Tr>
            </Thead>
            <Tbody>
              {events.map((entry) => (
                <Tr key={entry.eventId}>
                  <Td whiteSpace="nowrap">
                    <Text as="time" dateTime={entry.createdAt}>
                      {formatDate(entry.createdAt)}
                    </Text>
                  </Td>
                  <Td>{CERT_RUN_EVENT_LABELS[entry.event] ?? entry.event}</Td>
                  <Td>
                    <Badge colorScheme={CERT_RUN_STATUS_COLOR[entry.toStatus] ?? 'gray'}>
                      {CERT_RUN_STATUS_LABELS[entry.toStatus] ?? entry.toStatus}
                    </Badge>
                  </Td>
                  <Td>{entry.actorName}</Td>
                </Tr>
              ))}
              {placeholder && (
                <Tr>
                  <Td colSpan={COLUMN_COUNT}>{placeholder}</Td>
                </Tr>
              )}
            </Tbody>
          </Table>
          {hasMore && (
            <Button size="sm" type="button" mt={3} onClick={loadMore} isLoading={isLoadingMore}>
              Show more
            </Button>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};
