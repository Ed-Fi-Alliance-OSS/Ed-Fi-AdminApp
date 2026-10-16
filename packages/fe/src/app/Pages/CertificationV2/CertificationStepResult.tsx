import { Box, HStack, Text } from '@chakra-ui/react';
import { CertificationSavedStepRunDto } from '@edanalytics/models';
import { STEP_STATUS_DISPLAY, toDisplayStatus } from './certificationStepResults';

const formatRanAt = (ranAt: string) => {
  const date = new Date(ranAt);
  if (Number.isNaN(date.getTime())) return ranAt;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  );
};

/** The selected step's latest result: its saved run, or Running while a new run is in flight. */
export const CertificationStepResult = ({
  run,
  isRunning,
}: {
  run: CertificationSavedStepRunDto | undefined;
  isRunning: boolean;
}) => {
  const display = STEP_STATUS_DISPLAY[toDisplayStatus(run?.status, isRunning)];
  const shownRun = isRunning ? undefined : run;

  return (
    <>
      <HStack mb={3} justify="space-between" alignItems="center">
        <Text fontWeight="semibold">Execution result</Text>
        <HStack spacing={2}>
          <Box w="10px" h="10px" borderRadius="full" bg={display.dotColor} />
          <Text fontSize="sm" fontWeight="medium" color={display.textColor}>
            {display.label}
          </Text>
        </HStack>
      </HStack>

      {isRunning && <Text color="gray.600">Running this step. This can take up to a minute.</Text>}
      {!isRunning && !run && <Text color="gray.600">Execute this step to see its result.</Text>}

      {shownRun && (
        <>
          <Text mb={1}>Last execution: {formatRanAt(shownRun.ranAt)}</Text>

          {shownRun.errors.length > 0 && (
            <>
              <Text mb={3}>Errors: {shownRun.errors.length}</Text>
              <Text mb={2} fontWeight="medium">
                Validation errors:
              </Text>
              {shownRun.errors.map((item, index) => (
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
    </>
  );
};
