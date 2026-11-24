import {
  Box,
  Link,
  Progress,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { PageContentCard, PageTemplate } from '@edanalytics/common-ui';
import { CERT_RUN_STATUS_LABELS } from '@edanalytics/models';
import { Link as RouterLink, useParams } from 'react-router';
import { certificationRunPath } from '../../routes/paths';
import { useCanSeeCertification } from '../MyProducts/useCanSeeCertification';
import { useTeamRunHistory } from './useTeamRunHistory';

/** A run without scenarios (no catalog) has nothing to complete: an empty bar, not NaN. */
const percentComplete = (completed: number, total: number) =>
  total > 0 ? Math.round((completed / total) * 100) : 0;

/** Every run the team started, newest first, with scenario progress and a link to open it. */
export const RunHistoryPage = () => {
  const { asId } = useParams();
  const teamId = Number(asId);
  const { canSee, isLoading, error } = useCanSeeCertification(teamId);
  // Called before the early returns below; it only fetches once the user is known to have access.
  const history = useTeamRunHistory(teamId, canSee);

  if (isLoading) {
    return (
      <PageTemplate title="Run history">
        <Spinner />
      </PageTemplate>
    );
  }

  if (error) {
    // A failed access check is not a denial: show the real error, not "Not allowed".
    throw error;
  }

  if (!canSee) {
    // Caught by the route errorElement (ErrorFallback), which displays the message.
    throw new Error('Not allowed');
  }

  if (history.error) {
    // A failed request is not a denial: show the real error, not "Not allowed".
    throw history.error;
  }

  if (history.isLoading || !history.data) {
    return (
      <PageTemplate title="Run history">
        <Spinner />
      </PageTemplate>
    );
  }

  const runs = history.data;

  return (
    <PageTemplate title="Run history" customPageContentCard>
      <PageContentCard>
        {runs.length === 0 ? (
          <Text color="gray.600">No certification runs yet.</Text>
        ) : (
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Data store</Th>
                  <Th>Model</Th>
                  <Th>Status</Th>
                  <Th>Progress</Th>
                  <Th>Started</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {runs.map((run) => (
                  <Tr key={run.runId}>
                    <Td>{`${run.environmentName} · ${run.tenantName} · ${run.dataStoreName}`}</Td>
                    <Td>{run.certificationModel}</Td>
                    <Td>{CERT_RUN_STATUS_LABELS[run.status]}</Td>
                    <Td>
                      <Box minW="160px">
                        <Progress
                          size="sm"
                          borderRadius="full"
                          colorScheme="green"
                          value={percentComplete(run.completedScenarios, run.totalScenarios)}
                        />
                        <Text fontSize="sm" color="gray.600" mt={1}>
                          {`${run.completedScenarios} / ${run.totalScenarios}`}
                        </Text>
                      </Box>
                    </Td>
                    <Td>{new Date(run.createdAt).toLocaleDateString()}</Td>
                    <Td>
                      <Link
                        as={RouterLink}
                        to={certificationRunPath(teamId, run.runId)}
                        aria-label={`Open ${run.certificationModel} run on ${run.dataStoreName}`}
                      >
                        Open
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        )}
      </PageContentCard>
    </PageTemplate>
  );
};
