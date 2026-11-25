import { Box, Button, Progress, Spinner, Text } from '@chakra-ui/react';
import {
  PageContentCard,
  PageTemplate,
  SbaaColumnDef,
  SbaaTableAllInOne,
} from '@edanalytics/common-ui';
import { CERT_RUN_STATUS_LABELS, CertificationRunHistoryRowDto } from '@edanalytics/models';
import { useMemo } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { certificationRunPath } from '../../routes/paths';
import { useCanSeeCertification } from '../MyProducts/useCanSeeCertification';
import { useTeamRunHistory } from './useTeamRunHistory';

type RunHistoryTableRow = CertificationRunHistoryRowDto & { id: number; dataStore: string };

/** A run without scenarios (no catalog) has nothing to complete: an empty bar, not NaN. */
const percentComplete = (completed: number, total: number) =>
  total > 0 ? Math.round((completed / total) * 100) : 0;

const progressLabel = (run: CertificationRunHistoryRowDto) =>
  `${run.completedScenarios} / ${run.totalScenarios} scenarios completed`;

/** Every run the team started, newest first, with scenario progress and a button to open it. */
export const RunHistoryPage = () => {
  const { asId } = useParams();
  const teamId = Number(asId);
  const { canSee, isLoading, error } = useCanSeeCertification(teamId);
  // Called before the early returns below; it only fetches once the user is known to have access.
  const history = useTeamRunHistory(teamId, canSee);

  // The table needs an `id` per row; the API list is already newest first and the table is
  // paginated here, in the browser, like Vendors and Applications.
  const rows = useMemo<RunHistoryTableRow[]>(
    () =>
      (history.data ?? []).map((run) => ({
        ...run,
        id: run.runId,
        dataStore: `${run.environmentName} · ${run.tenantName} · ${run.dataStoreName}`,
      })),
    [history.data],
  );

  const columns = useMemo<SbaaColumnDef<RunHistoryTableRow>[]>(
    () => [
      { accessorKey: 'dataStore', header: 'Data store' },
      { accessorKey: 'certificationModel', header: 'Model' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => CERT_RUN_STATUS_LABELS[row.original.status],
      },
      {
        accessorKey: 'completedScenarios',
        header: 'Progress',
        cell: ({ row }) => (
          <Box minW="160px">
            <Progress
              size="sm"
              borderRadius="full"
              colorScheme="green"
              aria-label={progressLabel(row.original)}
              value={percentComplete(row.original.completedScenarios, row.original.totalScenarios)}
            />
            <Text fontSize="sm" color="gray.600" mt={1}>
              {progressLabel(row.original)}
            </Text>
          </Box>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Started',
        // Same format as Last updated on the certification dashboard.
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      },
      {
        id: 'open',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            as={RouterLink}
            to={certificationRunPath(teamId, row.original.runId)}
            size="sm"
            variant="outline"
            colorScheme="primary"
            aria-label={`Open ${row.original.certificationModel} run on ${row.original.dataStoreName}`}
          >
            Open
          </Button>
        ),
      },
    ],
    [teamId],
  );

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

  return (
    <PageTemplate title="Run history" customPageContentCard>
      <PageContentCard>
        {rows.length === 0 ? (
          <Text color="gray.600">No certification runs yet.</Text>
        ) : (
          <SbaaTableAllInOne data={rows} columns={columns} />
        )}
      </PageContentCard>
    </PageTemplate>
  );
};
