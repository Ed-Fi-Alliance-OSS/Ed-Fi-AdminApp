import { Alert, AlertIcon, Badge, Box, Button, HStack, Text } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import {
  CERT_NOT_ALL_SCENARIOS_COMPLETED,
  CertRunStatus,
  CertScenarioStatus,
  sendToReviewStatus,
} from '@edanalytics/models';
import { useRef } from 'react';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { useCanSeeCertification } from '../MyProducts/useCanSeeCertification';
import {
  CERT_RUN_STATUS_COLOR,
  CERT_RUN_STATUS_LABEL,
  countSuccessfulScenarios,
} from './certificationRunStatus';
import { certificationRunErrorMessage } from './useCertificationRun';
import { useSendCertificationRunToReview } from './useSendCertificationRunToReview';

const SENT_TO_REVIEW_NOTE =
  "This run was sent to review. Steps can't be executed unless reviewers request changes.";

/** Why steps can't be executed, for each status that locks the run. */
const LOCKED_NOTE: Partial<Record<CertRunStatus, string>> = {
  READY_FOR_REVIEW: SENT_TO_REVIEW_NOTE,
  READY_FOR_REVIEW_WITH_CHANGES: SENT_TO_REVIEW_NOTE,
  IN_REVIEW:
    "Reviewers are checking this run. Steps can't be executed unless they request changes.",
  APPROVED: "This run was approved. Steps can't be executed.",
  REJECTED: "This run was rejected. Steps can't be executed.",
};

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
  const {
    canRun,
    isLoading: isPermissionLoading,
    error: permissionError,
  } = useCanSeeCertification(teamId);
  // A failed or pending permission check isn't a denial.
  const isNotAllowed = !canRun && !isPermissionLoading && permissionError == null;
  const sendToReview = useSendCertificationRunToReview();
  const popBanner = usePopBanner();
  // The confirmation's Send button has no busy state, so a second click must not post again:
  // it would be refused (the run is already sent) and show a false error.
  const isSending = useRef(false);
  const { successful, total } = countSuccessfulScenarios(scenarioIds, statusByScenarioId);
  const isSendable = sendToReviewStatus(status) !== null;
  const allSucceeded = !isStatusUnknown && total > 0 && successful === total;
  const isDisabled = !isSendable || !allSucceeded || sendToReview.isPending;
  const lockedNote = LOCKED_NOTE[status];

  return (
    <Box mb={4}>
      <HStack spacing={4} wrap="wrap">
        <Badge colorScheme={CERT_RUN_STATUS_COLOR[status]} fontSize="sm" px={2} py={1}>
          {CERT_RUN_STATUS_LABEL[status]}
        </Badge>
        <Text>
          {isStatusUnknown
            ? 'Loading scenario results…'
            : `${successful} of ${total} scenarios successful`}
        </Text>
        {canRun && (
          <ConfirmAction
            headerText="Send to Review?"
            bodyText="Reviewers will check your results. You won't be able to execute steps again unless they request changes."
            yesButtonText="Send"
            noButtonText="Cancel"
            isDisabled={isDisabled}
            isYesLoading={sendToReview.isPending}
            action={async () => {
              if (isSending.current) return;
              isSending.current = true;
              try {
                await sendToReview.mutateAsync({ teamId, edfiTenantId, runId });
                popBanner({
                  type: 'Success',
                  title: 'Run sent to review',
                  message: "It's locked until the reviewers respond.",
                });
              } catch {
                // Shown from sendToReview.error below.
              } finally {
                isSending.current = false;
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
          {CERT_NOT_ALL_SCENARIOS_COMPLETED}
        </Text>
      )}
      {lockedNote && (
        <Text mt={2} fontSize="sm" color="gray.600">
          {lockedNote}
        </Text>
      )}
      {isNotAllowed && isSendable && (
        <Text mt={2} fontSize="sm" color="gray.600">
          You don't have permission to send runs to review.
        </Text>
      )}
      {/* A refusal stops mattering once the run can't be sent, e.g. another tab sent it. */}
      {sendToReview.error != null && isSendable && (
        <Alert status="error" mt={2} role="alert">
          <AlertIcon />
          {certificationRunErrorMessage(
            sendToReview.error,
            "The run couldn't be sent to review. Try again.",
          )}
        </Alert>
      )}
    </Box>
  );
};
