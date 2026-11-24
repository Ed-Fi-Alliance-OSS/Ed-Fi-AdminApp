import { Badge, Box, Button, Collapse, Heading, List, ListItem, Text } from '@chakra-ui/react';
import { CERT_RUN_EVENT_LABELS, CERT_RUN_STATUS_LABELS } from '@edanalytics/models';
import { useId, useState } from 'react';
import { CERT_RUN_STATUS_COLOR } from './certificationRunStatus';
import { useCertificationRunEvents } from './useCertificationRunEvents';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * The append-only history of the run (AC-650): every status change, oldest first, with who made
 * it and the reviewer's comment when there was one. Read-only; nothing here edits an entry.
 */
export const CertificationRunAuditHistory = ({
  teamId,
  runId,
}: {
  teamId: number;
  runId: number;
}) => {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(true);
  const { events, hasMore, loadMore, isLoadingMore, isError } = useCertificationRunEvents(
    teamId,
    runId,
  );

  return (
    <Box mb={4}>
      <Heading as="h2" size="sm" mb={2}>
        <Button
          variant="unstyled"
          size="sm"
          fontSize="inherit"
          height="auto"
          aria-expanded={isOpen}
          aria-controls={listId}
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? '▾' : '▸'} Audit history
        </Button>
      </Heading>
      <Collapse in={isOpen} animateOpacity unmountOnExit>
        <Box id={listId}>
          {isError ? (
            <Text color="red.600">The audit history couldn't be loaded.</Text>
          ) : events.length === 0 ? (
            <Text color="gray.600">No history yet.</Text>
          ) : (
            <List spacing={3}>
              {events.map((entry) => (
                <ListItem key={entry.eventId}>
                  <Text mb={1}>
                    <Text as="time" dateTime={entry.createdAt} color="gray.600">
                      {formatDate(entry.createdAt)}
                    </Text>{' '}
                    <Text as="span" fontWeight="semibold">
                      {CERT_RUN_EVENT_LABELS[entry.event] ?? entry.event}
                    </Text>{' '}
                    <Badge colorScheme={CERT_RUN_STATUS_COLOR[entry.toStatus] ?? 'gray'}>
                      {CERT_RUN_STATUS_LABELS[entry.toStatus] ?? entry.toStatus}
                    </Badge>{' '}
                    by {entry.actorName}
                  </Text>
                  {entry.comment !== null && <Text whiteSpace="pre-wrap">{entry.comment}</Text>}
                </ListItem>
              ))}
            </List>
          )}
          {hasMore && (
            <Button size="sm" mt={3} onClick={loadMore} isLoading={isLoadingMore}>
              Show more
            </Button>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};
