import {
  Alert,
  AlertIcon,
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  SimpleGrid,
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
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  CertificationStepDto,
  CertificationStepRunDto,
  CertificationStepRunsDto,
} from '@edanalytics/models';
import { certificationRunPath, myProductsPath } from '../../routes/paths';
import {
  RunCertificationStepVariables,
  useRunCertificationStep,
} from '../../api-v2/useRunCertificationStep';
import { CertificationAuthenticateForm } from './CertificationAuthenticateForm';
import { isAuthValidFor, useCertificationAuth } from './CertificationAuthContext';
import { CertificationStepResponseDetails } from './CertificationStepResponseDetails';
import { CertificationStepResult } from './CertificationStepResult';
import { CertificationStatusIndicator } from './CertificationStatusIndicator';
import { useCertificationSelection } from './useCertificationSelection';
import {
  displayNameOf,
  isUserInputParameter,
  parameterFieldOf,
  stepNameOf,
} from './certificationCatalog';
import {
  classifyRunError,
  STEP_STATUS_DISPLAY,
  toDisplayStatus,
  toParameterValues,
  toRunInputs,
} from './certificationStepResults';
import {
  certificationQueryKeys,
  useCertificationCatalog,
  useCertificationSteps,
} from './useCertificationCatalog';
import { toRunId, useCertificationRun } from './useCertificationRun';
import { useCertificationScenarioStatuses } from './useCertificationScenarioStatuses';
import { useCertificationStepRuns } from './useCertificationStepRuns';

const UNKNOWN_RESULT_MESSAGE =
  "We couldn't confirm this run's result. It may still have been saved, so the step statuses have been refreshed.";

export const CertificationPageExecution = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams();
  const teamId = Number(params.asId);
  const runId = toRunId(params.runId);
  // The run in the address fixes the environment, tenant and data store (AC-651).
  const { run: certificationRun } = useCertificationRun(teamId, runId);
  const edfiTenantId = certificationRun?.edfiTenantId;
  const odsId = certificationRun?.odsId;
  const { scenarioId } = useCertificationSelection();
  const { auth, clearAuth, clearReason } = useCertificationAuth();
  const catalog = useCertificationCatalog({
    teamId,
    sbEnvironmentId: certificationRun?.sbEnvironmentId,
    edfiTenantId,
    runDataStandardVersion: certificationRun?.dataStandardVersion,
  });
  const selected = useMemo(() => {
    for (const domain of catalog.domains) {
      const scenario = domain.scenarios.find((item) => item.scenarioId === scenarioId);
      if (scenario) return { domain, scenario };
    }
    return undefined;
  }, [catalog.domains, scenarioId]);
  const { steps: scenarioRows, isPending: isStepsPending } = useCertificationSteps({
    teamId,
    edfiTenantId,
    scenarioId: selected?.scenario.scenarioId,
  });
  // The same query as the Scenarios page, so both pages agree on whether steps can run.
  const scenarioStatuses = useCertificationScenarioStatuses({
    teamId,
    edfiTenantId,
    runId,
    enabled: edfiTenantId !== undefined,
  });
  // Saved results need no token; they are the run's own.
  const stepRuns = useCertificationStepRuns({
    teamId,
    edfiTenantId,
    runId,
    scenarioId: selected?.scenario.scenarioId,
  });
  const refetchStepRuns = stepRuns.refetch;
  const run = useRunCertificationStep({
    onSuccess: (result: CertificationStepRunDto, variables: RunCertificationStepVariables) => {
      // Another run may have been opened while this request was in flight.
      const stepRunsQueryKey = certificationQueryKeys.stepRuns(
        variables.teamId,
        variables.runId,
        variables.scenarioId,
      );
      // Show the new result right away; the API overwrote the saved one.
      const saved = {
        stepId: result.stepId,
        status: result.status,
        ranAt: result.ranAt,
        inputs: variables.body.inputs,
        responseStatus: result.responseStatus,
        errors: result.errors,
      };
      queryClient.setQueryData(
        stepRunsQueryKey,
        (previous: CertificationStepRunsDto | undefined): CertificationStepRunsDto => {
          const steps = previous?.steps ?? [];
          return {
            scenarioStatus: result.scenarioStatus,
            steps: steps.some((item) => item.stepId === saved.stepId)
              ? steps.map((item) => (item.stepId === saved.stepId ? saved : item))
              : [...steps, saved],
          };
        },
      );
      queryClient.invalidateQueries({ queryKey: stepRunsQueryKey });
      // The Scenarios page's statuses list is keyed separately; a step run can change the
      // scenario's overall status, so that list needs its own invalidation too.
      queryClient.invalidateQueries({
        queryKey: certificationQueryKeys.scenarioStatuses(variables.teamId, variables.runId),
      });
    },
    onError: (error: unknown) => {
      const kind = classifyRunError(error);
      if (kind.kind === 'unknown') {
        // A proxy timeout or dropped connection: the run may still have been saved.
        refetchStepRuns();
      }
      if (kind.kind === 'unknown' || kind.statusCode === 409) {
        queryClient.invalidateQueries({
          queryKey: certificationQueryKeys.scenarioStatuses(teamId, runId),
        });
      } else if (kind.notFound) {
        queryClient.invalidateQueries({ queryKey: certificationQueryKeys.all(teamId) });
      }
    },
  });
  const isAuthenticated = isAuthValidFor(auth, edfiTenantId, odsId);
  // No step can run while the run is in or awaiting review, so there is nothing to sign in for.
  const stepsBlocked = !scenarioStatuses.canExecuteSteps;

  const scenariosLocation = runId === undefined ? undefined : certificationRunPath(teamId, runId);

  const { unsupportedMessage } = catalog;
  useEffect(() => {
    // An address without a valid run ID has nothing to show.
    if (scenariosLocation === undefined) {
      navigate(myProductsPath(teamId), { replace: true });
      return;
    }
    // An unsupported environment has no catalog; it gets a warning here, not a redirect.
    if (unsupportedMessage) return;
    // Wait for the catalog before deciding a scenario ID from the URL doesn't exist. The
    // catalog stays pending until the run has loaded.
    const scenarioMissing = scenarioId === undefined || (!catalog.isPending && !selected);
    if (scenarioMissing) navigate(scenariosLocation, { replace: true });
  }, [
    unsupportedMessage,
    scenarioId,
    catalog.isPending,
    selected,
    navigate,
    scenariosLocation,
    teamId,
  ]);

  const [validatedStep, setValidatedStep] = useState<CertificationStepDto | null>(null);

  // Only `input` parameters are typed in; the app fills in `context` and `reference` ones.
  const parameterDefinitions = useMemo(
    () => (validatedStep?.parameters ?? []).filter(isUserInputParameter),
    [validatedStep],
  );

  // What the vendor typed this visit, per step; it wins over the saved run's inputs.
  const [typedValuesByStep, setTypedValuesByStep] = useState<
    Record<number, Record<string, string>>
  >({});
  const previousRunId = useRef(runId);
  useEffect(() => {
    if (previousRunId.current !== undefined && previousRunId.current !== runId) {
      setTypedValuesByStep({});
    }
    previousRunId.current = runId;
  }, [runId]);
  const selectedRun = validatedStep ? stepRuns.runsByStepId[validatedStep.stepId] : undefined;
  const parameterValues = useMemo(
    () => ({
      ...toParameterValues(parameterDefinitions, selectedRun?.inputs),
      ...(validatedStep ? typedValuesByStep[validatedStep.stepId] : undefined),
    }),
    [parameterDefinitions, selectedRun, validatedStep, typedValuesByStep],
  );

  // The API refuses these environments too. The Scenarios page would only repeat this
  // warning, so Cancel goes back to My products.
  if (unsupportedMessage) {
    return (
      <PageTemplate title="Certification">
        <Alert status="warning">
          <AlertIcon />
          {unsupportedMessage}
        </Alert>
        <ButtonGroup mt={4} colorScheme="primary">
          <Button
            variant="ghost"
            onClick={() => {
              clearAuth();
              navigate(myProductsPath(teamId));
            }}
          >
            Cancel
          </Button>
        </ButtonGroup>
      </PageTemplate>
    );
  }

  if (!selected || edfiTenantId === undefined || runId === undefined) {
    return null;
  }

  // A step run started on another run's page doesn't belong to this one.
  const mutationMatchesRun = run.variables === undefined || run.variables.runId === runId;
  const isRunningStep = (stepId: number) =>
    run.isPending && mutationMatchesRun && run.variables?.stepId === stepId;
  const canExecuteStep = parameterDefinitions.every((parameter) =>
    Boolean(parameterValues[parameter.parameterId]?.trim()),
  );
  // A run's error belongs to the step it ran, not to whichever step is open now.
  const runError =
    run.error && mutationMatchesRun && run.variables?.stepId === validatedStep?.stepId
      ? classifyRunError(run.error)
      : undefined;

  const executeStep = (step: CertificationStepDto) => {
    if (!isAuthenticated) return;
    run.reset();
    run.mutate({
      teamId,
      edfiTenantId,
      runId,
      stepId: step.stepId,
      scenarioId: step.scenarioId,
      body: {
        token: auth.token,
        inputs: toRunInputs(parameterDefinitions, parameterValues),
      },
    });
  };

  return (
    <PageTemplate title="Certification">
      {!stepsBlocked && (
        <Box mb={4} w="30em" maxW="100%">
          {!isAuthenticated && clearReason !== 'user' && (
            <Alert status="info" mb={3}>
              <AlertIcon />
              Your session has expired. Please validate your credentials again to continue.
            </Alert>
          )}
          <CertificationAuthenticateForm
            teamId={teamId}
            edfiTenantId={edfiTenantId}
            odsId={odsId}
          />
        </Box>
      )}
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
                  Domain
                </Text>
                <Text fontSize="lg" fontWeight="bold" color="blue.800">
                  {displayNameOf(selected.domain)}
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
              {scenarioRows.map((row) => {
                const status = toDisplayStatus(
                  stepRuns.runsByStepId[row.stepId]?.status,
                  isRunningStep(row.stepId),
                );
                const display = STEP_STATUS_DISPLAY[status];
                return (
                  <Tr key={row.stepId}>
                    <Td>{stepNameOf(row)}</Td>
                    <Td>
                      <CertificationStatusIndicator
                        display={display}
                        fontWeight={status === 'notExecuted' ? 'normal' : 'medium'}
                      />
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        colorScheme="primary"
                        type="button"
                        onClick={() => setValidatedStep(row)}
                      >
                        Open
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
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
            // Parameters and their result side by side on wide screens; stacked otherwise.
            <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6} mt={6} alignItems="start">
              <Box
                w="full"
                p={5}
                border="1px solid"
                borderColor="gray.200"
                borderRadius="md"
                bg="gray.50"
              >
                {/* Orange asks for input; a step with nothing to fill in gets a neutral blue note. */}
                {parameterDefinitions.length > 0 ? (
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
                      Complete the fields below, then click Execute step to run validation for the
                      selected step.
                    </Text>
                  </Box>
                ) : (
                  <Box
                    mb={4}
                    p={3}
                    border="1px solid"
                    borderColor="blue.200"
                    bg="blue.50"
                    borderRadius="md"
                  >
                    <Text fontSize="md" fontWeight="semibold" color="blue.800" mb={1}>
                      Ready to execute
                    </Text>
                    <Text fontSize="sm" color="blue.900">
                      This step doesn't need any parameters. Click Execute step when you're ready.
                    </Text>
                  </Box>
                )}

                {parameterDefinitions.map((parameter) => {
                  const { label, hint } = parameterFieldOf(parameter);
                  return (
                    <FormControl key={parameter.parameterId} mb={4}>
                      <FormLabel>{label}</FormLabel>
                      <Input
                        placeholder={hint ?? `Enter ${label.toLowerCase()}`}
                        value={parameterValues[parameter.parameterId] ?? ''}
                        onChange={(event) => {
                          const { stepId } = validatedStep;
                          const { value } = event.target;
                          setTypedValuesByStep((prev) => ({
                            ...prev,
                            [stepId]: { ...prev[stepId], [parameter.parameterId]: value },
                          }));
                        }}
                      />
                      {hint && <FormHelperText>Format: {hint}</FormHelperText>}
                    </FormControl>
                  );
                })}

                {runError?.kind === 'api' && (
                  <Alert status="error" mb={3}>
                    <AlertIcon />
                    {runError.message}
                  </Alert>
                )}
                {runError?.kind === 'unknown' && (
                  <Alert status="warning" mb={3}>
                    <AlertIcon />
                    {UNKNOWN_RESULT_MESSAGE}
                  </Alert>
                )}

                <HStack spacing={3} alignItems="center">
                  <Button
                    colorScheme="primary"
                    type="button"
                    isDisabled={
                      !isAuthenticated ||
                      !canExecuteStep ||
                      !scenarioStatuses.canExecuteSteps ||
                      run.isPending
                    }
                    onClick={() => executeStep(validatedStep)}
                  >
                    Execute step
                  </Button>
                  {!stepsBlocked && !isAuthenticated && (
                    <Text fontSize="sm" color="gray.600">
                      Validate your credentials above to execute this step.
                    </Text>
                  )}
                </HStack>
                {stepsBlocked && (
                  <Text mt={2} fontSize="sm" color="gray.600">
                    Steps can't be executed while this run is in review.
                  </Text>
                )}
              </Box>
              <Box
                w="full"
                minW={0}
                p={5}
                border="1px solid"
                borderColor="gray.200"
                borderRadius="md"
              >
                <CertificationStepResult
                  run={selectedRun}
                  isRunning={isRunningStep(validatedStep.stepId)}
                />
              </Box>
            </SimpleGrid>
          )}

          {validatedStep && (
            // Full width below both columns: long values such as descriptor URIs fit on one line.
            <Box mt={6}>
              <CertificationStepResponseDetails
                // A new run or step starts closed, so its snapshot loads only when opened.
                key={`${runId}:${validatedStep.stepId}`}
                run={selectedRun}
                isRunning={isRunningStep(validatedStep.stepId)}
                snapshotArgs={{ teamId, edfiTenantId, runId }}
              />
            </Box>
          )}

          {!validatedStep && (
            <Text color="gray.600" mb={2}>
              Select Open on a row to load its dynamic parameters.
            </Text>
          )}

          <ButtonGroup mt={4} colorScheme="primary">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                navigate(certificationRunPath(teamId, runId));
              }}
            >
              Back
            </Button>
          </ButtonGroup>
        </Box>
      </chakra.form>
    </PageTemplate>
  );
};
