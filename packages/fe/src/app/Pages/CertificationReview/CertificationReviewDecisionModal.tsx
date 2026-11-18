import {
  Alert,
  AlertIcon,
  Button,
  FormControl,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react';
import {
  CERT_REVIEW_COMMENT_MAX_LENGTH,
  CertReviewDecision,
  reviewDecisionNeedsComment,
} from '@edanalytics/models';
import { useEffect, useState } from 'react';
import { useCertificationReviewDecision } from './useCertificationReview';

const COPY: Record<
  CertReviewDecision,
  { title: string; label: string; confirm: string; colorScheme: string; toast: string }
> = {
  APPROVED: {
    title: 'Approve this run?',
    label: 'Comment (optional)',
    confirm: 'Approve',
    colorScheme: 'green',
    toast: 'Run approved',
  },
  REJECTED: {
    title: 'Reject this run?',
    label: 'Reason',
    confirm: 'Reject',
    colorScheme: 'red',
    toast: 'Run rejected',
  },
  CHANGES_REQUESTED: {
    title: 'Request changes?',
    label: 'What needs to change',
    confirm: 'Request changes',
    colorScheme: 'orange',
    toast: 'Changes requested',
  },
};

const errorMessage = (error: unknown): string => {
  const message = (error as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(' ');
  return typeof message === 'string' && message
    ? message
    : "The decision couldn't be saved. Try again.";
};

export const CertificationReviewDecisionModal = ({
  runId,
  decision,
  onClose,
  onDecided,
}: {
  runId: number;
  decision: CertReviewDecision | null;
  onClose: () => void;
  onDecided: (decision: CertReviewDecision) => void;
}) => {
  const toast = useToast();
  const { mutateAsync, isPending } = useCertificationReviewDecision();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  // A fresh form each time the modal opens.
  useEffect(() => {
    setComment('');
    setError(null);
  }, [decision]);

  const copy = decision ? COPY[decision] : undefined;
  const trimmed = comment.trim();
  const blocked = decision !== null && reviewDecisionNeedsComment(decision) && trimmed === '';

  const confirm = async () => {
    if (!decision || !copy || isPending || blocked) return;
    setError(null);
    try {
      await mutateAsync({ runId, decision, comment: trimmed === '' ? undefined : trimmed });
    } catch (e) {
      if ((e as { statusCode?: number } | null)?.statusCode === 409) {
        toast({ title: 'This run changed. Refreshing.', status: 'warning', isClosable: true });
        onClose();
      } else {
        setError(errorMessage(e));
      }
      return;
    }
    toast({ title: copy.toast, status: 'success', isClosable: true });
    onDecided(decision);
  };

  return (
    <Modal isOpen={decision !== null} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{copy?.title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            <FormLabel>{copy?.label}</FormLabel>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={CERT_REVIEW_COMMENT_MAX_LENGTH}
              rows={5}
            />
            <Text fontSize="sm" color="gray.600" textAlign="right" mt={1}>
              {comment.length} / {CERT_REVIEW_COMMENT_MAX_LENGTH}
            </Text>
          </FormControl>
          {error && (
            <Alert status="error" mt={3}>
              <AlertIcon />
              {error}
            </Alert>
          )}
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme={copy?.colorScheme}
            onClick={confirm}
            isLoading={isPending}
            isDisabled={blocked || isPending}
          >
            {copy?.confirm}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
