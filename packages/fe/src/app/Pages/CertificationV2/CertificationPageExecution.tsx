import {
  Alert,
  AlertIcon,
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Text,
  Tr,
  chakra,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CertificationStepDto } from '@edanalytics/models';
import { useNavToParent } from '../../helpers';
import { config } from '../../../config/config';
import { CertificationAuthenticateForm } from './CertificationAuthenticateForm';
import { isAuthValidFor, useCertificationAuth } from './CertificationAuthContext';
import { useCertificationSelection } from './useCertificationSelection';
import { displayNameOf } from './certificationCatalog';
import { useCertificationCatalog, useCertificationSteps } from './useCertificationCatalog';

const stepNameOf = (step: CertificationStepDto) => step.displayName?.trim() || step.stepName;

type ValidationErrorResult = {
  property: string;
  validation: string;
  error: string;
};

type ExecutionResult = {
  scenarioStep: string;
  lastModifiedDate: string;
  isValid: boolean;
  successful: number;
  errors: number;
  'validation-errors': ValidationErrorResult[];
};

type RowExecutionStatus = 'Not executed' | 'Successful' | 'Failed';

export const CertificationPageExecution = () => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();
  const sbEnvironmentId = Number(useParams().sbEnvironmentId);
  const { edfiTenantId, odsId, scenarioId } = useCertificationSelection();
  const { auth, clearReason } = useCertificationAuth();
  const catalog = useCertificationCatalog(sbEnvironmentId);
  const selected = useMemo(() => {
    for (const area of catalog.areas) {
      const scenario = area.scenarios.find((item) => item.scenarioId === scenarioId);
      if (scenario) return { area, scenario };
    }
    return undefined;
  }, [catalog.areas, scenarioId]);
  const { steps: scenarioRows, isPending: isStepsPending } = useCertificationSteps(
    sbEnvironmentId,
    selected?.scenario.scenarioId,
  );
  const isAuthenticated = isAuthValidFor(auth, edfiTenantId, odsId);

  // Going back must keep the tenant/ODS choice; the request page doesn't use the scenario.
  const parentLocation = useMemo(() => {
    const params = new URLSearchParams();
    if (edfiTenantId !== undefined) params.set('edfiTenantId', String(edfiTenantId));
    if (odsId !== undefined) params.set('odsId', String(odsId));
    const query = params.toString();
    return { pathname: navToParentOptions, search: query ? `?${query}` : '' };
  }, [edfiTenantId, odsId, navToParentOptions]);

  useEffect(() => {
    // Wait for the catalog before deciding a scenario ID from the URL doesn't exist.
    const scenarioMissing = scenarioId === undefined || (!catalog.isPending && !selected);
    if (scenarioMissing || edfiTenantId === undefined) {
      navigate(parentLocation, { replace: true });
    }
  }, [scenarioId, catalog.isPending, selected, edfiTenantId, navigate, parentLocation]);

  const [validatedStep, setValidatedStep] = useState<CertificationStepDto | null>(null);

  const parameterDefinitions = useMemo(() => validatedStep?.parameters ?? [], [validatedStep]);

  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [nextExecutionIsSuccess, setNextExecutionIsSuccess] = useState(true);
  const [rowExecutionStatusById, setRowExecutionStatusById] = useState<
    Record<number, RowExecutionStatus>
  >({});

  useEffect(() => {
    setRowExecutionStatusById((prev) => {
      let hasChanges = false;
      const next = { ...prev };

      scenarioRows.forEach((row) => {
        if (next[row.stepId] === undefined) {
          next[row.stepId] = 'Not executed';
          hasChanges = true;
        }
      });

      return hasChanges ? next : prev;
    });
  }, [scenarioRows]);

  useEffect(() => {
    if (!validatedStep) {
      setParameterValues({});
      return;
    }

    const initialValues = parameterDefinitions.reduce<Record<string, string>>((acc, parameter) => {
      acc[parameter.parameterId] = '';
      return acc;
    }, {});

    setParameterValues(initialValues);
  }, [validatedStep, parameterDefinitions]);

  if (!config.showRequestCertification) {
    return null;
  }

  if (!selected || edfiTenantId === undefined) {
    return null;
  }

  const canExecuteScenario = parameterDefinitions.every((parameter) =>
    Boolean(parameterValues[parameter.parameterId]?.trim()),
  );

  const formattedLastExecution = (() => {
    if (!executionResult) {
      return '';
    }

    const executionDate = new Date(executionResult.lastModifiedDate);
    if (Number.isNaN(executionDate.getTime())) {
      return executionResult.lastModifiedDate;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(executionDate);
  })();

  return (
    <PageTemplate title="Certification">
      <Box mb={4} w="30em" maxW="100%">
        {!isAuthenticated && clearReason !== 'user' && (
          <Alert status="info" mb={3}>
            <AlertIcon />
            Your session has expired. Please validate your credentials again to continue.
          </Alert>
        )}
        <CertificationAuthenticateForm
          sbEnvironmentId={sbEnvironmentId}
          edfiTenantId={edfiTenantId}
          odsId={odsId}
        />
      </Box>
      <chakra.form w="full">
        <Box w="full">
          <Box
            mb={4}
            p={4}
            border="1px solid"
            borderColor="blue.200"
            bg="blue.50"
            borderRadius="md"
            borderLeftWidth="6px"
            borderLeftColor="blue.500"
          >
            <HStack spacing={8} alignItems="flex-start" flexWrap="wrap">
              <Box>
                <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="wide">
                  Group or Area
                </Text>
                <Text fontSize="lg" fontWeight="bold" color="blue.800">
                  {displayNameOf(selected.area)}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="wide">
                  Scenario
                </Text>
                <Text fontSize="lg" fontWeight="bold" color="blue.800">
                  {displayNameOf(selected.scenario)}
                </Text>
              </Box>
            </HStack>
          </Box>

          <Table size="sm" mb={6}>
            <Thead>
              <Tr>
                <Th>Step</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {scenarioRows.map((row) => (
                <Tr key={row.stepId}>
                  <Td>{stepNameOf(row)}</Td>
                  <Td>
                    {(() => {
                      const status = rowExecutionStatusById[row.stepId] ?? 'Not executed';
                      const statusColor =
                        status === 'Successful'
                          ? 'green.600'
                          : status === 'Failed'
                            ? 'red.600'
                            : 'gray.600';
                      const dotColor =
                        status === 'Successful'
                          ? 'green.500'
                          : status === 'Failed'
                            ? 'red.500'
                            : 'gray.400';

                      return (
                        <HStack spacing={2}>
                          <Box w="8px" h="8px" borderRadius="full" bg={dotColor} />
                          <Text
                            color={statusColor}
                            fontWeight={status === 'Not executed' ? 'normal' : 'medium'}
                          >
                            {status}
                          </Text>
                        </HStack>
                      );
                    })()}
                  </Td>
                  <Td>
                    <Button
                      size="sm"
                      colorScheme="primary"
                      type="button"
                      isDisabled={!isAuthenticated}
                      onClick={() => {
                        setValidatedStep(row);
                        setExecutionResult(null);
                      }}
                    >
                      Validate
                    </Button>
                  </Td>
                </Tr>
              ))}
              {scenarioRows.length === 0 && (
                <Tr>
                  <Td colSpan={3}>
                    <Text color="gray.600">
                      {isStepsPending ? 'Loading steps...' : 'No steps found for this scenario.'}
                    </Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>

          {validatedStep && (
            <Box
              w="full"
              maxW="42em"
              mt={6}
              p={5}
              border="1px solid"
              borderColor="gray.200"
              borderRadius="md"
              bg="gray.50"
            >
              <Box
                mb={4}
                p={3}
                border="1px solid"
                borderColor="orange.200"
                bg="orange.50"
                borderRadius="md"
              >
                <Text fontSize="md" fontWeight="semibold" color="orange.800" mb={1}>
                  Enter Validation Parameters
                </Text>
                <Text fontSize="sm" color="orange.900">
                  Complete the fields below, then click Execute Scenario to run validation for the
                  selected step.
                </Text>
              </Box>

              {parameterDefinitions.map((parameter) => (
                <FormControl key={parameter.parameterId} mb={4}>
                  <FormLabel>{parameter.description?.trim() || parameter.name}</FormLabel>
                  <Input
                    placeholder={`Enter ${parameter.name}`}
                    value={parameterValues[parameter.parameterId] ?? ''}
                    onChange={(event) => {
                      setParameterValues((prev) => ({
                        ...prev,
                        [parameter.parameterId]: event.target.value,
                      }));
                    }}
                  />
                </FormControl>
              ))}

              <Button
                colorScheme="primary"
                type="button"
                isDisabled={!isAuthenticated || !canExecuteScenario}
                onClick={() => {
                  const hasErrors = !nextExecutionIsSuccess;

                  setExecutionResult({
                    scenarioStep: stepNameOf(validatedStep),
                    lastModifiedDate: new Date().toISOString(),
                    isValid: !hasErrors,
                    successful: 15,
                    errors: hasErrors ? 2 : 0,
                    'validation-errors': hasErrors
                      ? [
                          {
                            property: 'alternateDayName',
                            validation: 'isString',
                            error: 'expected undefined to be a string',
                          },
                          {
                            property: 'alternateDayName',
                            validation: 'isNotEmpty',
                            error: '.empty was passed non-string primitive undefined',
                          },
                        ]
                      : [],
                  });

                  setRowExecutionStatusById((prev) => ({
                    ...prev,
                    [validatedStep.stepId]: hasErrors ? 'Failed' : 'Successful',
                  }));

                  setNextExecutionIsSuccess((prev) => !prev);
                }}
              >
                Execute Scenario
              </Button>
            </Box>
          )}

          {!validatedStep && (
            <Text color="gray.600" mb={2}>
              Select Validate on a row to load its dynamic parameters.
            </Text>
          )}

          <ButtonGroup mt={4} colorScheme="primary">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                navigate(parentLocation);
              }}
            >
              Back
            </Button>
          </ButtonGroup>
        </Box>
      </chakra.form>

      <Box mt={8} w="30em" borderTop="1px solid" borderColor="gray.200" pt={6}>
        <HStack mb={3} justify="space-between" alignItems="center">
          <Text fontWeight="semibold">Execution result</Text>
          {executionResult ? (
            <HStack spacing={2}>
              <Box
                w="10px"
                h="10px"
                borderRadius="full"
                bg={executionResult.isValid ? 'green.500' : 'red.500'}
              />
              <Text
                fontSize="sm"
                fontWeight="medium"
                color={executionResult.isValid ? 'green.600' : 'red.600'}
              >
                {executionResult.isValid ? 'Successful' : 'Errors found'}
              </Text>
            </HStack>
          ) : (
            <Text fontSize="sm" color="gray.500">
              Not executed
            </Text>
          )}
        </HStack>

        {executionResult && (
          <>
            <Text mb={1}>Last execution: {formattedLastExecution}</Text>

            {executionResult.errors > 0 && executionResult['validation-errors'].length > 0 && (
              <>
                <Text mb={3}>Errors: {executionResult.errors}</Text>
                <Text mb={2} fontWeight="medium">
                  Validation errors:
                </Text>
                {executionResult['validation-errors'].map((item, index) => (
                  <Box
                    key={`${item.property}-${item.validation}-${index}`}
                    mb={3}
                    p={3}
                    border="1px solid"
                    borderColor="red.200"
                    bg="red.50"
                    borderLeftWidth="4px"
                    borderLeftColor="red.500"
                    borderRadius="md"
                  >
                    <HStack mb={2} spacing={2}>
                      <Box w="8px" h="8px" borderRadius="full" bg="red.500" />
                      <Text fontSize="sm" fontWeight="semibold" color="red.700">
                        Error
                      </Text>
                    </HStack>
                    <Text mb={1}>Property: {item.property}</Text>
                    <Text mb={1}>Validation: {item.validation}</Text>
                    <Text>Error: {item.error}</Text>
                  </Box>
                ))}
              </>
            )}
          </>
        )}
        {executionResult === null && (
          <Text color="gray.600">Run the scenario to see the simulated response.</Text>
        )}
      </Box>
    </PageTemplate>
  );
};
