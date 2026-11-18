import { Badge, Box, SimpleGrid, Text } from '@chakra-ui/react';
import { CERT_RUN_STATUS_LABELS, CertificationReviewRunDto } from '@edanalytics/models';
import { ReactNode } from 'react';
import { CERT_RUN_STATUS_COLOR } from '../CertificationV2/certificationRunStatus';

const RunFact = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box>
    <Text fontSize="sm" color="gray.600">
      {label}
    </Text>
    <Box fontWeight="semibold">{children}</Box>
  </Box>
);

const formatSent = (submittedAt: string | null) => {
  if (!submittedAt) return '—';
  const date = new Date(submittedAt);
  return Number.isNaN(date.getTime()) ? submittedAt : date.toLocaleString();
};

/** Who sent the run, where it ran, and where it stands in review. */
export const CertificationReviewHeader = ({ run }: { run: CertificationReviewRunDto }) => (
  <SimpleGrid
    role="group"
    aria-label="Certification run"
    columns={{ base: 2, lg: 3 }}
    spacing={4}
    mb={4}
    p={4}
    border="1px solid"
    borderColor="gray.200"
    borderRadius="md"
  >
    {/* Runs created before AC-651 have no team. */}
    <RunFact label="Team">{run.teamName ?? '—'}</RunFact>
    <RunFact label="Environment / Tenant">
      {run.environmentName} / {run.tenantName}
    </RunFact>
    <RunFact label="Data store">{run.dataStoreName ?? '—'}</RunFact>
    <RunFact label="Certification Model">{run.certificationModel}</RunFact>
    <RunFact label="Status">
      <Badge colorScheme={CERT_RUN_STATUS_COLOR[run.status]} fontSize="sm" px={2} py={1}>
        {CERT_RUN_STATUS_LABELS[run.status]}
      </Badge>
    </RunFact>
    <RunFact label="Sent">{formatSent(run.submittedAt)}</RunFact>
  </SimpleGrid>
);
