import {
  Alert,
  AlertIcon,
  Box,
  Button,
  ButtonGroup,
  HStack,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { certificationReviewPath, routeDefinitions } from '../../routes/paths';
import { CertificationStatusIndicator } from '../CertificationV2/CertificationStatusIndicator';
import { CertificationStepResponseDetails } from '../CertificationV2/CertificationStepResponseDetails';
import { CertificationStepResult } from '../CertificationV2/CertificationStepResult';
import { toDisplayStatus } from '../CertificationV2/certificationStepResults';
import { CertificationReviewHeader } from './CertificationReviewHeader';
import { REVIEW_PAGE_TITLE, REVIEW_STEP_STATUS_DISPLAY } from './reviewDisplay';
import { useReviewRun } from './useReviewRun';

/** The scenario of the address (`?scenarioId=`), or undefined when it isn't a positive whole number. */
const toScenarioId = (value: string | null): number | undefined => {
  const scenarioId = Number(value);
  return value && Number.isInteger(scenarioId) && scenarioId > 0 ? scenarioId : undefined;
};

const BannerFact = ({ label, value }: { label: string; value: string }) => (
  <Box>
    <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="wide">
      {label}
    </Text>
    <Text fontSize="lg" fontWeight="bold" color="blue.800">
      {value}
    </Text>
  </Box>
);

/**
 * One scenario's steps as a global admin reads them, laid out like the vendor's steps page, but
 * read-only: no parameters, no Execute and no decisions (those are on the scenarios page).
 */
export const CertificationReviewStepsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scenarioId = toScenarioId(searchParams.get('scenarioId'));
  const [openStepId, setOpenStepId] = useState<number | undefined>();
  const reviewRun = useReviewRun();

  if (reviewRun.state === 'loading') {
    return (
      <PageTemplate title={REVIEW_PAGE_TITLE}>
        <Spinner />
      </PageTemplate>
    );
  }

  if (reviewRun.state === 'notFound') {
    return (
      <PageTemplate title={REVIEW_PAGE_TITLE}>
        <Alert status="warning">
          <AlertIcon />
          This certification run wasn&apos;t found.
        </Alert>
      </PageTemplate>
    );
  }

  const { runId, data, isUnavailable, snapshotSource } = reviewRun;
  const scenario = data.scenarios.find((candidate) => candidate.scenarioId === scenarioId);
  const backButton = (
    <ButtonGroup mt={4} colorScheme="primary">
      <Button
        variant="ghost"
        type="button"
        onClick={() => navigate(certificationReviewPath(runId))}
      >
        Back
      </Button>
    </ButtonGroup>
  );

  if (!scenario) {
    return (
      <PageTemplate title={REVIEW_PAGE_TITLE}>
        <Alert status="warning">
          <AlertIcon />
          This scenario wasn&apos;t found.
        </Alert>
        {backButton}
      </PageTemplate>
    );
  }

  const openStep = scenario.steps.find((step) => step.stepId === openStepId);
  const openResult = openStep?.result ?? undefined;

  return (
    <PageTemplate title={REVIEW_PAGE_TITLE}>
      {isUnavailable && (
        <Alert status="warning" mb={4}>
          <AlertIcon />
          <Text flex="1">This run is no longer available for review.</Text>
          <Button size="sm" onClick={() => navigate(routeDefinitions.certificationDashboard.index)}>
            Back to the Certification dashboard
          </Button>
        </Alert>
      )}

      <CertificationReviewHeader run={data.run} />

      <Box
        role="group"
        aria-label="Scenario"
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
          <BannerFact label="Domain" value={scenario.domainName} />
          <BannerFact label="Scenario" value={scenario.name} />
        </HStack>
      </Box>

      <Table size="sm" mb={6} aria-label="Steps">
        <Thead>
          <Tr>
            <Th>Step</Th>
            <Th>Status</Th>
            <Th>Action</Th>
          </Tr>
        </Thead>
        <Tbody>
          {scenario.steps.map((step) => {
            const status = toDisplayStatus(step.result?.status, false);
            return (
              <Tr key={step.stepId}>
                <Td>{step.name}</Td>
                <Td>
                  <CertificationStatusIndicator
                    display={REVIEW_STEP_STATUS_DISPLAY[status]}
                    fontWeight={status === 'notExecuted' ? 'normal' : 'medium'}
                  />
                </Td>
                <Td>
                  <Button
                    size="sm"
                    colorScheme="primary"
                    type="button"
                    aria-pressed={step.stepId === openStepId}
                    onClick={() => setOpenStepId(step.stepId)}
                  >
                    Open
                  </Button>
                </Td>
              </Tr>
            );
          })}
          {scenario.steps.length === 0 && (
            <Tr>
              <Td colSpan={3}>
                <Text color="gray.600">No steps found for this scenario.</Text>
              </Td>
            </Tr>
          )}
        </Tbody>
      </Table>

      {openStep ? (
        <>
          <Box w="full" minW={0} p={5} border="1px solid" borderColor="gray.200" borderRadius="md">
            <CertificationStepResult
              run={openResult}
              isRunning={false}
              notRunMessage="This step wasn't run."
            />
          </Box>
          <Box mt={6}>
            <CertificationStepResponseDetails
              // A newly opened step starts closed, so its snapshot loads only when opened.
              key={`${runId}:${openStep.stepId}`}
              run={openResult}
              isRunning={false}
              snapshotSource={snapshotSource}
            />
          </Box>
        </>
      ) : (
        scenario.steps.length > 0 && (
          <Text color="gray.600" mb={2}>
            Select Open on a row to see its result.
          </Text>
        )
      )}

      {backButton}
    </PageTemplate>
  );
};
