import {
  Alert,
  AlertIcon,
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormLabel,
  HStack,
  Select,
  SimpleGrid,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  chakra,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { ReactNode, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { getOdsTerminology } from '../../helpers';
import { certificationRunExecutionPath, myProductsPath } from '../../routes/paths';
import { CertificationAuthenticateForm } from './CertificationAuthenticateForm';
import { CertificationStatusIndicator } from './CertificationStatusIndicator';
import { isAuthValidFor, useCertificationAuth } from './CertificationAuthContext';
import { useCertificationSelection } from './useCertificationSelection';
import { displayNameOf, formatArtifactVersion } from './certificationCatalog';
import { useCertificationCatalog } from './useCertificationCatalog';
import { toRunId, useCertificationRun } from './useCertificationRun';
import { useCertificationScenarioStatuses } from './useCertificationScenarioStatuses';
import { SCENARIO_STATUS_DISPLAY, toScenarioDisplayStatus } from './certificationStepResults';

const TITLE = 'Scenarios';

const RunFact = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box>
    <Text fontSize="sm" color="gray.600">
      {label}
    </Text>
    <Text fontWeight="semibold">{children}</Text>
  </Box>
);

/**
 * The scenarios of one certification run (AC-651). The run in the address fixes the
 * environment, tenant, data store and Certification Model; choosing them happens in the
 * Request New Certification popup on My products.
 */
export const CertificationScenariosPage = () => {
  const navigate = useNavigate();
  const params = useParams();
  const teamId = Number(params.asId);
  const runId = toRunId(params.runId);
  const { run, isPending: isRunPending } = useCertificationRun(teamId, runId);
  const { toSearch } = useCertificationSelection();
  const { auth, clearAuth } = useCertificationAuth();
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const catalog = useCertificationCatalog({
    teamId,
    sbEnvironmentId: run?.sbEnvironmentId,
    edfiTenantId: run?.edfiTenantId,
  });
  const hasCatalog = catalog.catalogVersion !== undefined;

  const tableScenarios = useMemo(
    () =>
      catalog.domains
        .filter((domain) => selectedDomainId === '' || String(domain.domainId) === selectedDomainId)
        .flatMap((domain) => domain.scenarios.map((scenario) => ({ domain, scenario }))),
    [catalog.domains, selectedDomainId],
  );

  const scenarioStatuses = useCertificationScenarioStatuses({
    teamId,
    edfiTenantId: run?.edfiTenantId,
    runId,
    enabled: hasCatalog,
  });

  const isAuthenticated = isAuthValidFor(auth, run?.edfiTenantId, run?.odsId);

  const backButtons = (
    <ButtonGroup mt={4} colorScheme="primary">
      <Button
        variant="ghost"
        type="button"
        onClick={() => {
          // The token is for this run's data store only; it isn't kept after leaving.
          clearAuth();
          navigate(myProductsPath(teamId));
        }}
      >
        Back to My products
      </Button>
    </ButtonGroup>
  );

  // Until the run loads we can't tell what to show. A run the user may not see never gets
  // here: its 404 goes to the route error page.
  if (isRunPending) {
    return (
      <PageTemplate title={TITLE}>
        <Text>Loading...</Text>
      </PageTemplate>
    );
  }

  if (!run || runId === undefined) {
    return (
      <PageTemplate title={TITLE}>
        <Alert status="warning">
          <AlertIcon />
          This certification run wasn&apos;t found.
        </Alert>
        {backButtons}
      </PageTemplate>
    );
  }

  // The API refuses these environments too; this keeps the page and says why.
  if (catalog.unsupportedMessage) {
    return (
      <PageTemplate title={TITLE}>
        <Alert status="warning">
          <AlertIcon />
          {catalog.unsupportedMessage}
        </Alert>
        {backButtons}
      </PageTemplate>
    );
  }

  return (
    <PageTemplate title={TITLE}>
      <chakra.form w="full">
        <SimpleGrid
          role="group"
          aria-label="Certification run"
          columns={{ base: 2, lg: 4 }}
          spacing={4}
          mb={4}
          p={4}
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
        >
          <RunFact label="Environment">{run.environmentName}</RunFact>
          <RunFact label="Tenant">{run.tenantName}</RunFact>
          <RunFact label={getOdsTerminology(catalog.sbEnvironment?.version).singular}>
            {run.dataStoreName}
          </RunFact>
          <RunFact label="Certification Model">{run.certificationModel}</RunFact>
        </SimpleGrid>

        <Box w="30em" maxW="100%">
          {/* Credentials are only for running steps. While the run is in review no step can run,
              so there is nothing to validate and the form is hidden. The form is also how a
              vendor continues after the token expires or the page reloads. */}
          {scenarioStatuses.canExecuteSteps && (
            <CertificationAuthenticateForm
              teamId={teamId}
              edfiTenantId={run.edfiTenantId}
              odsId={run.odsId}
            />
          )}

          <Box mt={4}>
            {catalog.isPending ? (
              <Text color="gray.600">Loading certification version...</Text>
            ) : catalog.catalogVersion ? (
              <>
                <Text>
                  Certification {formatArtifactVersion(catalog.catalogVersion.artifactVersion)}
                </Text>
                <Text>Data Standard {catalog.catalogVersion.dataStandardVersion}</Text>
              </>
            ) : (
              <Text color="gray.600">Certification version not available</Text>
            )}
          </Box>

          {!catalog.isPending && !hasCatalog && (
            <Alert status="warning" mt={4}>
              <AlertIcon />
              {/* An unknown data standard is unsupported, so it never reaches this alert. */}
              No certification catalog is available for data standard {catalog.dataStandardVersion}.
            </Alert>
          )}

          <FormControl>
            <FormLabel>Domain Filter</FormLabel>
            <Select
              placeholder={hasCatalog ? 'All domains' : 'No catalog available'}
              value={selectedDomainId}
              isDisabled={!hasCatalog}
              onChange={(event) => setSelectedDomainId(event.target.value)}
            >
              {catalog.domains.map((domain) => (
                <option key={domain.domainId} value={domain.domainId}>
                  {displayNameOf(domain)}
                </option>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box mt={6} p={4} border="1px solid" borderColor="gray.200" borderRadius="md" bg="gray.50">
          <Text mb={3} fontWeight="semibold">
            Scenarios
          </Text>

          {scenarioStatuses.isLoading && (
            <HStack role="status" spacing={2} mb={3}>
              <Spinner size="xs" label="" />
              <Text fontSize="sm" color="gray.600">
                Loading scenario statuses...
              </Text>
            </HStack>
          )}
          {scenarioStatuses.isError && (
            <Alert status="warning" mb={3} role="alert">
              <AlertIcon />
              <Text flex="1">
                {scenarioStatuses.isStale
                  ? "We couldn't refresh the scenario statuses. The statuses shown may be out of date."
                  : "We couldn't load the scenario statuses."}
              </Text>
              <Button size="sm" type="button" onClick={() => scenarioStatuses.refetch()}>
                Retry
              </Button>
            </Alert>
          )}

          <Table size="sm" mt={0}>
            <Thead>
              <Tr>
                <Th>Domain</Th>
                <Th>Scenario</Th>
                <Th>Status</Th>
                <Th textAlign="right">Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {tableScenarios.map(({ domain, scenario }) => {
                const display =
                  SCENARIO_STATUS_DISPLAY[
                    toScenarioDisplayStatus(
                      scenarioStatuses.statusByScenarioId[scenario.scenarioId],
                    )
                  ];
                return (
                  <Tr key={scenario.scenarioId}>
                    <Td>{displayNameOf(domain)}</Td>
                    <Td>{displayNameOf(scenario)}</Td>
                    <Td>
                      {scenarioStatuses.isUnknown ? (
                        <Text color="gray.600" aria-label="Status not available">
                          —
                        </Text>
                      ) : (
                        <CertificationStatusIndicator display={display} fontSize="sm" />
                      )}
                    </Td>
                    <Td textAlign="right">
                      <Button
                        size="sm"
                        colorScheme="primary"
                        type="button"
                        // Opening is allowed in every run status, so a vendor can still read a
                        // run's results while it's in review. Credentials are only needed when
                        // steps can run; the steps page blocks running.
                        isDisabled={scenarioStatuses.canExecuteSteps && !isAuthenticated}
                        onClick={() =>
                          navigate({
                            pathname: certificationRunExecutionPath(teamId, runId),
                            search: toSearch({ scenarioId: scenario.scenarioId }),
                          })
                        }
                      >
                        Open Scenario
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
              {tableScenarios.length === 0 && (
                <Tr>
                  <Td colSpan={4}>
                    <Text color="gray.600">
                      {catalog.isPending
                        ? 'Loading scenarios...'
                        : 'No scenarios found for the current filters.'}
                    </Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </Box>

        {backButtons}
      </chakra.form>
    </PageTemplate>
  );
};
