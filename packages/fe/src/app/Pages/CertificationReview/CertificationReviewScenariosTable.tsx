import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Select,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { CertificationReviewScenarioDto } from '@edanalytics/models';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { certificationReviewStepsPath } from '../../routes/paths';
import { CertificationStatusIndicator } from '../CertificationV2/CertificationStatusIndicator';
import { toScenarioDisplayStatus } from '../CertificationV2/certificationStepResults';
import {
  countPassedSteps,
  REVIEW_SCENARIO_STATUS_DISPLAY,
  reviewDomainNames,
} from './reviewDisplay';

/**
 * The run's scenarios as the vendor's Scenarios page lays them out: a domain filter and one row
 * per scenario, with how many of its steps passed and a way into its steps page.
 */
export const CertificationReviewScenariosTable = ({
  runId,
  scenarios,
}: {
  runId: number;
  scenarios: CertificationReviewScenarioDto[];
}) => {
  const navigate = useNavigate();
  // The filter lives in the address, so it survives refetches and the way back from a steps page.
  const [searchParams, setSearchParams] = useSearchParams();
  const domainNames = useMemo(() => reviewDomainNames(scenarios), [scenarios]);
  // A domain the run doesn't have (an edited address, or one gone after a refetch) shows them all.
  const requested = searchParams.get('domain') ?? '';
  const domainName = domainNames.includes(requested) ? requested : '';
  const shown = domainName
    ? scenarios.filter((scenario) => scenario.domainName === domainName)
    : scenarios;

  if (scenarios.length === 0) {
    return <Text color="gray.600">This run has no scenarios to show.</Text>;
  }

  return (
    <>
      <Box w="30em" maxW="100%" mb={4}>
        <FormControl>
          <FormLabel>Domain Filter</FormLabel>
          <Select
            placeholder="All domains"
            value={domainName}
            onChange={(event) =>
              setSearchParams(event.target.value ? { domain: event.target.value } : {}, {
                replace: true,
              })
            }
          >
            {domainNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box p={4} border="1px solid" borderColor="gray.200" borderRadius="md" bg="gray.50">
        <Text mb={3} fontWeight="semibold">
          Scenarios
        </Text>
        <Table size="sm" aria-label="Scenarios">
          <Thead>
            <Tr>
              <Th>Domain</Th>
              <Th>Scenario</Th>
              <Th>Tasks verified</Th>
              <Th>Status</Th>
              <Th textAlign="right">Action</Th>
            </Tr>
          </Thead>
          <Tbody>
            {shown.map((scenario) => {
              const { passed, total } = countPassedSteps(scenario.steps);
              const display =
                REVIEW_SCENARIO_STATUS_DISPLAY[
                  toScenarioDisplayStatus(scenario.status ?? undefined)
                ];
              return (
                <Tr key={scenario.scenarioId}>
                  <Td>{scenario.domainName}</Td>
                  <Td>{scenario.name}</Td>
                  <Td>{`${passed} of ${total}`}</Td>
                  <Td>
                    <CertificationStatusIndicator display={display} fontSize="sm" />
                  </Td>
                  <Td textAlign="right">
                    <Button
                      size="sm"
                      colorScheme="primary"
                      type="button"
                      onClick={() =>
                        navigate(
                          certificationReviewStepsPath(runId, scenario.scenarioId, domainName),
                        )
                      }
                    >
                      View steps
                    </Button>
                  </Td>
                </Tr>
              );
            })}
            {shown.length === 0 && (
              <Tr>
                <Td colSpan={5}>
                  <Text color="gray.600">No scenarios found for the current filters.</Text>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>
    </>
  );
};
