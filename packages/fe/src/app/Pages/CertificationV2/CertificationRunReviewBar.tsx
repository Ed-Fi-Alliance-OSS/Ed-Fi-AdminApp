import { Alert, AlertIcon, Badge, Box, Button, HStack, Text } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { CertRunStatus, CertScenarioStatus, sendToReviewStatus } from '@edanalytics/models';
import { useCanSeeCertification } from '../MyProducts/useCanSeeCertification';
import {
  CERT_RUN_STATUS_COLOR,
  CERT_RUN_STATUS_LABEL,
  countSuccessfulScenarios,
} from './certificationRunStatus';
import { useSendCertificationRunToReview } from './useSendCertificationRunToReview';

const NOT_ALL_SUCCEEDED = 'Every scenario must succeed before you can send the run to review.';

type CertificationRunReviewBarProps = {
  teamId: number;
  edfiTenantId: number;
  runId: number;
  status: CertRunStatus;
  /** Every scenario of the run's catalog, whatever the page's domain filter shows. */
  scenarioIds: number[];
  statusByScenarioId: Partial<Record<number, CertScenarioStatus>>;
  /** True until the scenario statuses have loaded; sending waits for them. */
  isStatusUnknown: boolean;
};

/**
 * The run's status, how many scenarios succeeded, and Send to Review (AC-659). Sending is
 * possible from Draft or Changes requested once every scenario succeeded; the API checks both
 * again. Users without certification:run see the status but not the action.
 */
export const CertificationRunReviewBar = ({
  teamId,
  edfiTenantId,
  runId,
  status,
  scenarioIds,
  statusByScenarioId,
  isStatusUnknown,
}: CertificationRunReviewBarProps) => {
  const { canRun } = useCanSeeCertification(teamId);
  const sendToReview = useSendCertificationRunToReview();
  const { successful, total } = countSuccessfulScenarios(scenarioIds, statusByScenarioId);
  const isSendable = sendToReviewStatus(status) !== null;
  const allSucceeded = !isStatusUnknown && total > 0 && successful === total;
  const isDisabled = !isSendable || !allSucceeded || sendToReview.isPending;
  const sendError = sendToReview.error as { message?: unknown } | null;

  return (
    <Box mb={4}>
      <HStack spacing={4} wrap="wrap">
        <Badge colorScheme={CERT_RUN_STATUS_COLOR[status]} fontSize="sm" px={2} py={1}>
          {CERT_RUN_STATUS_LABEL[status]}
        </Badge>
        <Text>
          {successful} of {total} scenarios successful
        </Text>
        {canRun && (
          <ConfirmAction
            headerText="Send to Review?"
            bodyText="You won't be able to run steps on this run again until changes are requested."
            yesButtonText="Send"
            noButtonText="Cancel"
            isDisabled={isDisabled}
            action={async () => {
              try {
                await sendToReview.mutateAsync({ teamId, edfiTenantId, runId });
              } catch {
                // Shown from sendToReview.error below.
              }
            }}
          >
            {(buttonProps) => (
              <Button
                type="button"
                colorScheme="primary"
                isDisabled={isDisabled}
                isLoading={sendToReview.isPending}
                {...buttonProps}
              >
                Send to Review
              </Button>
            )}
          </ConfirmAction>
        )}
      </HStack>
      {canRun && isSendable && !allSucceeded && !isStatusUnknown && (
        <Text mt={2} fontSize="sm" color="gray.600">
          {NOT_ALL_SUCCEEDED}
        </Text>
      )}
      {sendError && (
        <Alert status="error" mt={2} role="alert">
          <AlertIcon />
          {typeof sendError.message === 'string' && sendError.message
            ? sendError.message
            : "The run couldn't be sent to review. Try again."}
        </Alert>
      )}
    </Box>
  );
};
