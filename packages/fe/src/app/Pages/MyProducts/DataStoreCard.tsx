import { Badge, Box, Code, Divider, Flex, Heading, Link, Text } from '@chakra-ui/react';
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
    <Flex align="center" gap={2} mt={1} mb={3} color="gray.600" wrap="wrap">
      <Code>{dataStore.environmentName}</Code>
      <Code>{dataStore.tenantName}</Code>
    </Flex>
    {dataStore.runs.map((run) => (
      <Box key={run.runId}>
        <Divider />
        <Flex justify="space-between" align="center" py={3} gap={4}>
          <Text fontWeight="semibold">{run.certificationModel}</Text>
          <Flex align="center" gap={4}>
            <Badge
              colorScheme="gray"
              borderRadius="full"
              px={3}
              py={1}
              textTransform="none"
              fontWeight="semibold"
            >
              {CERT_RUN_STATUS_LABELS[run.status]}
            </Badge>
            <Link
              as={RouterLink}
              to={certificationRunPath(teamId, run.runId)}
              aria-label={`Open ${run.certificationModel} run on ${dataStore.dataStoreName}`}
            >
              Open
            </Link>
          </Flex>
        </Flex>
      </Box>
    ))}
  </Box>
);
