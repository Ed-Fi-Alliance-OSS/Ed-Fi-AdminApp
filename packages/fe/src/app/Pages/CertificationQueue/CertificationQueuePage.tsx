import { Badge, Box, Button, Spinner, Text, Tooltip } from '@chakra-ui/react';
import {
  PageContentCard,
  PageTemplate,
  SbaaColumnDef,
  SbaaTableAllInOne,
} from '@edanalytics/common-ui';
import { CERT_RUN_STATUS_LABELS, CertificationDashboardRunDto } from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router';
import { AuthorizeConfig, authorize, usePrivilegeCacheForConfig } from '../../helpers';
import { certificationReviewPath } from '../../routes/paths';
import { certRunStatusColor } from '../CertificationV2/certificationRunStatusColor';
import { PickUpCertificationRunButton } from '../CertificationReview/PickUpCertificationRunButton';
import { REVIEW_CERTIFICATION } from '../CertificationReview/reviewAuthorization';
import { pickUpDisabledReason } from './pickUpAvailability';
import { useCertificationRunList } from './useCertificationRunList';

const TITLE = 'Review queue';
const EMPTY = '—';
const NO_REVIEW_PERMISSION = 'You need review permission';

const READ_CERTIFICATION: AuthorizeConfig = {
  privilege: 'certification:read',
  subject: { id: '__filtered__' },
};

type QueueTableRow = CertificationDashboardRunDto & {
  id: number;
  statusLabel: string;
};

export const CertificationQueuePage = () => {
  const queryClient = useQueryClient();
  // Until the privilege cache arrives authorize() is false, which must not read as "not allowed".
  const privilegeCache = [
    ...usePrivilegeCacheForConfig(READ_CERTIFICATION),
    ...usePrivilegeCacheForConfig(REVIEW_CERTIFICATION),
  ];
  const canRead = authorize({ queryClient, config: READ_CERTIFICATION });
  const canReview = authorize({ queryClient, config: REVIEW_CERTIFICATION });
  const { data, error, isLoading } = useCertificationRunList(canRead);

  const rows = useMemo<QueueTableRow[]>(
    () =>
      (data?.rows ?? []).map((run) => ({
        ...run,
        id: run.runId,
        statusLabel: CERT_RUN_STATUS_LABELS[run.status],
      })),
    [data?.rows],
  );

  const columns = useMemo<SbaaColumnDef<QueueTableRow>[]>(
    () => [
      {
        id: 'product',
        header: 'Product',
        accessorFn: (run) => run.dataStore ?? `${run.sbEnvironmentName} / ${run.edfiTenantName}`,
      },
      {
        id: 'vendor',
        header: 'Vendor',
        accessorFn: (run) => run.teamName ?? EMPTY,
      },
      { accessorKey: 'certificationModel', header: 'Model' },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (run) => run.statusLabel,
        filterFn: 'equalsString',
        meta: { type: 'options' },
        cell: ({ row }) => (
          <Badge colorScheme={certRunStatusColor(row.original.status)}>
            {row.original.statusLabel}
          </Badge>
        ),
      },
      {
        id: 'lastActivity',
        header: 'Last activity',
        accessorFn: (run) => new Date(run.updatedAt).toLocaleString(),
        sortFn: (a, b) => a.original.updatedAt.localeCompare(b.original.updatedAt),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const { runId, status } = row.original;
          const disabledReason = pickUpDisabledReason(status, canReview);
          return (
            <Box display="flex" gap={2}>
              <PickUpCertificationRunButton
                runId={runId}
                isDisabled={disabledReason !== null}
                disabledReason={disabledReason ?? undefined}
              />
              {canReview ? (
                <Button
                  as={RouterLink}
                  to={certificationReviewPath(runId)}
                  size="sm"
                  variant="outline"
                  colorScheme="primary"
                >
                  Open
                </Button>
              ) : (
                <Tooltip label={NO_REVIEW_PERMISSION}>
                  <span>
                    <Button size="sm" variant="outline" colorScheme="primary" isDisabled>
                      Open
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Box>
          );
        },
      },
    ],
    [canReview],
  );

  const privilegeCacheError = privilegeCache.find((cache) => cache.error)?.error;
  if (privilegeCacheError) {
    throw privilegeCacheError;
  }

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
    throw error;
  }

  if (isLoading || !data) {
    return (
      <PageTemplate title={TITLE}>
        <Spinner />
      </PageTemplate>
    );
  }

  return (
    <PageTemplate title={TITLE} customPageContentCard>
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
