import {
  Badge,
  Box,
  Button,
  Collapse,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import {
  CERT_RUN_EVENT_LABELS,
  CERT_RUN_STATUS_LABELS,
  CertificationRunEventDto,
} from '@edanalytics/models';
import { useId, useState } from 'react';
import { CERT_RUN_STATUS_COLOR } from './certificationRunStatus';
import { useCertificationRunEvents } from './useCertificationRunEvents';

const COLUMN_COUNT = 5;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const eventLabel = (entry: CertificationRunEventDto) =>
  CERT_RUN_EVENT_LABELS[entry.event] ?? entry.event;

/** The reviewer's full comment on one entry; it can be up to 4000 characters. */
const CommentModal = ({
  entry,
  onClose,
}: {
  entry: CertificationRunEventDto | null;
  onClose: () => void;
}) => (
  <Modal isOpen={entry !== null} onClose={onClose} size="lg" scrollBehavior="inside">
    <ModalOverlay />
    <ModalContent>
      <ModalHeader>Comment from {entry?.actorName}</ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        {entry && (
          <>
            <Text fontSize="sm" color="gray.600" mb={3}>
              {eventLabel(entry)} ·{' '}
              <Text as="time" dateTime={entry.createdAt}>
                {formatDate(entry.createdAt)}
              </Text>
            </Text>
            <Text data-testid="audit-history-comment" whiteSpace="pre-wrap" overflowWrap="anywhere">
              {entry.comment}
            </Text>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button type="button" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </ModalContent>
  </Modal>
);

/**
 * The append-only history of the run (AC-650): every status change, newest first, with who made
 * it. A reviewer's comment can be long, so its row links to it and a dialog shows it in full.
 * Read-only; nothing here edits an entry.
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
  const [commentEntry, setCommentEntry] = useState<CertificationRunEventDto | null>(null);
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
          <Text as="span" aria-hidden="true">
            {isOpen ? '▾' : '▸'}
          </Text>{' '}
          Audit history
        </Button>
      </Heading>
      <Box id={tableId}>
        <Collapse in={isOpen} animateOpacity unmountOnExit>
          <Table size="sm" mt={0} aria-label="Audit history">
            <Thead>
              <Tr>
                <Th>Date</Th>
                <Th>Event</Th>
                <Th>Status</Th>
                <Th>By</Th>
                <Th>Comment</Th>
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
                  <Td>{eventLabel(entry)}</Td>
                  <Td>
                    <Badge colorScheme={CERT_RUN_STATUS_COLOR[entry.toStatus] ?? 'gray'}>
                      {CERT_RUN_STATUS_LABELS[entry.toStatus] ?? entry.toStatus}
                    </Badge>
                  </Td>
                  <Td>{entry.actorName}</Td>
                  <Td>
                    {entry.comment ? (
                      <Button
                        size="sm"
                        variant="link"
                        type="button"
                        onClick={() => setCommentEntry(entry)}
                      >
                        View comment
                      </Button>
                    ) : (
                      <Text as="span" color="gray.500" aria-label="No comment">
                        —
                      </Text>
                    )}
                  </Td>
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
        </Collapse>
      </Box>
      <CommentModal entry={commentEntry} onClose={() => setCommentEntry(null)} />
    </Box>
  );
};
