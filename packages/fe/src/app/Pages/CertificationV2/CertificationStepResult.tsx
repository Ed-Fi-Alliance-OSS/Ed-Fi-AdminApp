import {
  Badge,
  Box,
  Button,
  Code,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import {
  CERT_STEP_ERROR_KIND,
  CertificationSavedStepRunDto,
  CertificationStepSnapshotDto,
} from '@edanalytics/models';
import { useState } from 'react';
import { STEP_STATUS_DISPLAY, toDisplayStatus } from './certificationStepResults';
import {
  useCertificationStepSnapshot,
  UseCertificationStepSnapshotArgs,
} from './useCertificationStepSnapshot';

const formatRanAt = (ranAt: string) => {
  const date = new Date(ranAt);
  if (Number.isNaN(date.getTime())) return ranAt;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  );
};

const REASON_PHRASES: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

const statusLabel = (status: number) =>
  REASON_PHRASES[status] ? `HTTP ${status} ${REASON_PHRASES[status]}` : `HTTP ${status}`;

export const SNAPSHOT_DISCLAIMER =
  'This snapshot is deleted when the certification request is approved or rejected.';

const SNAPSHOT_MESSAGES: Record<Exclude<CertificationStepSnapshotDto['state'], 'body'>, string> = {
  tooLarge:
    'The response is larger than the 64 KB snapshot limit. To review it, call the Ed-Fi API directly.',
  none: "No response: the request wasn't sent.",
  deleted: 'The snapshot was deleted when the certification request was decided.',
};

const SnapshotContent = ({
  snapshot,
  isPending,
  isError,
}: ReturnType<typeof useCertificationStepSnapshot>) => {
  if (isPending) return <Text color="gray.600">Loading the response…</Text>;
  if (isError || !snapshot) return <Text color="gray.600">The response couldn't be loaded.</Text>;
  if (snapshot.state === 'body') {
    return (
      <Code as="pre" display="block" whiteSpace="pre-wrap" p={3} maxH="24em" overflowY="auto">
        {snapshot.body}
      </Code>
    );
  }
  return <Text color="gray.600">{SNAPSHOT_MESSAGES[snapshot.state]}</Text>;
};

/** The selected step's latest result: its saved run, or Running while a new run is in flight. */
export const CertificationStepResult = ({
  run,
  isRunning,
  snapshotArgs,
}: {
  run: CertificationSavedStepRunDto | undefined;
  isRunning: boolean;
  snapshotArgs: Omit<UseCertificationStepSnapshotArgs, 'enabled' | 'stepId' | 'ranAt'>;
}) => {
  const [isSnapshotOpen, setSnapshotOpen] = useState(false);
  const display = STEP_STATUS_DISPLAY[toDisplayStatus(run?.status, isRunning)];
  const shownRun = isRunning ? undefined : run;
  const snapshot = useCertificationStepSnapshot({
    ...snapshotArgs,
    stepId: shownRun?.stepId,
    ranAt: shownRun?.ranAt,
    enabled: isSnapshotOpen && shownRun !== undefined,
  });

  const exceptions =
    shownRun?.errors.filter((e) => e.kind === CERT_STEP_ERROR_KIND.exception) ?? [];
  const fields = shownRun?.errors.filter((e) => e.kind !== CERT_STEP_ERROR_KIND.exception) ?? [];

  return (
    <>
      <HStack mb={3} justify="space-between" alignItems="center">
        <Text fontWeight="semibold">Execution result</Text>
        <HStack spacing={2}>
          <Box w="10px" h="10px" borderRadius="full" bg={display.dotColor} />
          <Text fontSize="sm" fontWeight="medium" color={display.textColor}>
            {display.label}
          </Text>
        </HStack>
      </HStack>

      {isRunning && <Text color="gray.600">Running this step. This can take up to a minute.</Text>}
      {!isRunning && !run && <Text color="gray.600">Execute this step to see its result.</Text>}

      {shownRun && (
        <>
          <HStack mb={3} spacing={3} wrap="wrap">
            <Text>Last execution: {formatRanAt(shownRun.ranAt)}</Text>
            {shownRun.responseStatus !== null && (
              // The colour follows the step: a "was Deleted" step passes on an expected 404.
              <Badge
                data-status={shownRun.status}
                colorScheme={shownRun.status === 'success' ? 'gray' : 'red'}
              >
                {statusLabel(shownRun.responseStatus)}
              </Badge>
            )}
          </HStack>

          {exceptions.map((item, index) => (
            <Box
              key={`exception-${index}`}
              mb={3}
              p={3}
              border="1px solid"
              borderColor="red.200"
              bg="red.50"
              borderLeftWidth="4px"
              borderLeftColor="red.500"
              borderRadius="md"
            >
              <Text color="red.700" overflowWrap="anywhere">
                {item.message}
              </Text>
              {item.observed && (
                <Text mt={1} fontSize="sm" color="red.700">
                  {item.observed}
                </Text>
              )}
            </Box>
          ))}

          {fields.length > 0 && (
            <Box mb={3}>
              <Text mb={2} fontWeight="medium">
                {fields.length === 1 ? '1 field' : `${fields.length} fields`} didn't match
              </Text>
              {/* Descriptor URIs, nested paths and compact JSON have no spaces to wrap at. */}
              <Box overflowX="auto">
                <Table size="sm" sx={{ td: { overflowWrap: 'anywhere' } }}>
                  <Thead>
                    <Tr>
                      <Th>Field</Th>
                      <Th>Expected</Th>
                      <Th>Observed</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {fields.map((item, index) => (
                      <Tr key={`${item.field}-${index}`}>
                        <Td fontFamily="mono">{item.field}</Td>
                        {item.expected === null && item.observed === null && item.message ? (
                          // A check Bruno can't split into expected/observed: its message is the explanation.
                          <Td colSpan={2} color="red.700">
                            {item.message}
                          </Td>
                        ) : (
                          <>
                            <Td>{item.expected ?? '—'}</Td>
                            <Td color="red.700">{item.observed ?? '—'}</Td>
                          </>
                        )}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </Box>
          )}

          <Button
            size="sm"
            variant="link"
            aria-expanded={isSnapshotOpen}
            onClick={() => setSnapshotOpen((open) => !open)}
          >
            {isSnapshotOpen ? '▾' : '▸'} Response from the API
          </Button>
          {isSnapshotOpen && (
            <Box mt={2}>
              <Text mb={2} fontSize="sm" color="gray.600">
                {SNAPSHOT_DISCLAIMER}
              </Text>
              <SnapshotContent {...snapshot} />
            </Box>
          )}
        </>
      )}
    </>
  );
};
