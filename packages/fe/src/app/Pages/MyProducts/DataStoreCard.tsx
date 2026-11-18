import { Box, Flex, Heading, Link, Text } from '@chakra-ui/react';
import { CERT_RUN_STATUS_LABELS, CertificationTeamDashboardDataStoreDto } from '@edanalytics/models';
import { Link as RouterLink } from 'react-router';
import { certificationRunPath } from '../../routes/paths';

/** One data store with the latest run of each model that has one, and a link into each run. */
export const DataStoreCard = ({
  teamId,
  dataStore,
}: {
  teamId: number;
  dataStore: CertificationTeamDashboardDataStoreDto;
}) => (
  <Box borderWidth="1px" borderRadius="md" p={4}>
    <Heading as="h3" size="sm">
      {dataStore.dataStoreName}
    </Heading>
    <Text color="gray.600" mb={3}>
      {dataStore.environmentName} / {dataStore.tenantName}
    </Text>
    {dataStore.runs.map((run) => (
      <Flex key={run.runId} justify="space-between" align="center" py={1} gap={4}>
        <Text fontWeight="semibold">{run.certificationModel}</Text>
        <Text flex="1">{CERT_RUN_STATUS_LABELS[run.status]}</Text>
        <Link as={RouterLink} to={certificationRunPath(teamId, run.runId)}>
          Open
        </Link>
      </Flex>
    ))}
  </Box>
);
