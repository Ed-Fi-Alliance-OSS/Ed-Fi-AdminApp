import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Heading,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import { CertificationReviewScenarioDto } from '@edanalytics/models';
import { useMemo, useState } from 'react';
import { CertificationStatusIndicator } from '../CertificationV2/CertificationStatusIndicator';
import { CertificationStepResponseDetails } from '../CertificationV2/CertificationStepResponseDetails';
import { CertificationStepResult } from '../CertificationV2/CertificationStepResult';
import {
  SCENARIO_STATUS_DISPLAY,
  STEP_STATUS_DISPLAY,
  toDisplayStatus,
  toScenarioDisplayStatus,
} from '../CertificationV2/certificationStepResults';
import type { CertificationSnapshotSource } from '../CertificationV2/useCertificationStepSnapshot';

type SelectedStep = { scenarioId: number; stepId: number };

const groupByDomain = (scenarios: CertificationReviewScenarioDto[]) => {
  const groups = new Map<string, CertificationReviewScenarioDto[]>();
  for (const scenario of scenarios) {
    groups.set(scenario.domainName, [...(groups.get(scenario.domainName) ?? []), scenario]);
  }
  return [...groups.entries()];
};

const ScenarioItem = ({
  scenario,
  selectedStepId,
  onSelectStep,
  snapshotSource,
}: {
  scenario: CertificationReviewScenarioDto;
  selectedStepId: number | undefined;
  onSelectStep: (stepId: number) => void;
  snapshotSource: CertificationSnapshotSource;
}) => {
  const selectedStep = scenario.steps.find((step) => step.stepId === selectedStepId);
  const result = selectedStep?.result ?? undefined;
  return (
    <AccordionItem>
      <AccordionButton>
        <HStack flex="1" justify="space-between" mr={2}>
          <Text textAlign="left">{scenario.name}</Text>
          <CertificationStatusIndicator
            display={SCENARIO_STATUS_DISPLAY[toScenarioDisplayStatus(scenario.status ?? undefined)]}
            fontSize="sm"
          />
        </HStack>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel>
        {scenario.steps.length === 0 ? (
          <Text color="gray.600">This scenario has no steps.</Text>
        ) : (
          <Stack spacing={1} align="flex-start">
            {scenario.steps.map((step) => (
              <HStack key={step.stepId} spacing={3}>
                <Button
                  size="sm"
                  variant={step.stepId === selectedStepId ? 'solid' : 'ghost'}
                  aria-pressed={step.stepId === selectedStepId}
                  onClick={() => onSelectStep(step.stepId)}
                >
                  {step.name}
                </Button>
                <CertificationStatusIndicator
                  display={STEP_STATUS_DISPLAY[toDisplayStatus(step.result?.status, false)]}
                  fontSize="sm"
                />
              </HStack>
            ))}
          </Stack>
        )}
        {selectedStep && (
          <Stack spacing={4} mt={4}>
            <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="md">
              <CertificationStepResult
                run={result}
                isRunning={false}
                notRunMessage="This step wasn't run."
              />
            </Box>
            <CertificationStepResponseDetails
              // A fresh, closed panel for each step.
              key={selectedStep.stepId}
              run={result}
              isRunning={false}
              snapshotSource={snapshotSource}
            />
          </Stack>
        )}
      </AccordionPanel>
    </AccordionItem>
  );
};

/** The run's scenarios by domain; opening one lists its steps, and a step shows its result. */
export const CertificationReviewScenarios = ({
  scenarios,
  snapshotSource,
}: {
  scenarios: CertificationReviewScenarioDto[];
  snapshotSource: CertificationSnapshotSource;
}) => {
  const [selected, setSelected] = useState<SelectedStep | undefined>();
  const domains = useMemo(() => groupByDomain(scenarios), [scenarios]);

  if (scenarios.length === 0) {
    return <Text color="gray.600">This run has no scenarios to show.</Text>;
  }

  return (
    <Stack spacing={6}>
      {domains.map(([domainName, domainScenarios]) => (
        <Box key={domainName}>
          <Heading as="h3" size="sm" mb={2}>
            {domainName}
          </Heading>
          <Accordion allowMultiple>
            {domainScenarios.map((scenario) => (
              <ScenarioItem
                key={scenario.scenarioId}
                scenario={scenario}
                selectedStepId={
                  selected?.scenarioId === scenario.scenarioId ? selected.stepId : undefined
                }
                onSelectStep={(stepId) => setSelected({ scenarioId: scenario.scenarioId, stepId })}
                snapshotSource={snapshotSource}
              />
            ))}
          </Accordion>
        </Box>
      ))}
    </Stack>
  );
};
