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

type RunHistoryTableRow = CertificationRunHistoryRowDto & {
  id: number;
  dataStore: string;
  statusLabel: string;
  startedLabel: string;
};

const percentComplete = (completed: number, total: number) =>
  total > 0 ? Math.round((completed / total) * 100) : 0;

const progressLabel = (run: CertificationRunHistoryRowDto) =>
  `${run.completedScenarios} / ${run.totalScenarios} scenarios completed`;

export const RunHistoryPage = () => {
  const { asId } = useParams();
  const teamId = Number(asId);
  const { canSee, isLoading, error } = useCanSeeCertification(teamId);
  const history = useTeamRunHistory(teamId, canSee);
  const loadError = error ?? history.error;

  const rows = useMemo<RunHistoryTableRow[]>(
    () =>
      (history.data ?? []).map((run) => ({
        ...run,
        id: run.runId,
        dataStore: `${run.environmentName} · ${run.tenantName} · ${run.dataStoreName}`,
        statusLabel: CERT_RUN_STATUS_LABELS[run.status],
        startedLabel: new Date(run.createdAt).toLocaleString(),
      })),
    [history.data],
  );

  const columns = useMemo<SbaaColumnDef<RunHistoryTableRow>[]>(
    () => [
      { accessorKey: 'dataStore', header: 'Data store' },
      { accessorKey: 'certificationModel', header: 'Model' },
      {
        accessorKey: 'statusLabel',
        header: 'Status',
      },
      {
        id: 'progress',
        accessorFn: (run) => percentComplete(run.completedScenarios, run.totalScenarios),
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
        accessorKey: 'startedLabel',
        header: 'Started',
        sortFn: (a, b) => a.original.createdAt.localeCompare(b.original.createdAt),
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

  if (loadError) {
    throw loadError;
  }

  if (!canSee) {
    throw new Error('Not allowed');
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
