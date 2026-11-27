import { Button, Tooltip, useToast } from '@chakra-ui/react';
import { useNavigate } from 'react-router';
import { certificationReviewPath } from '../../routes/paths';
import { usePickUpCertificationRun } from './useCertificationReview';

/** One mutation per button, so each Pick up shows its own pending state. */
export const PickUpCertificationRunButton = ({
  runId,
  isDisabled = false,
  disabledReason,
}: {
  runId: number;
  isDisabled?: boolean;
  disabledReason?: string;
}) => {
  const navigate = useNavigate();
  const toast = useToast();
  const { mutateAsync, isPending } = usePickUpCertificationRun();

  const pickUp = async () => {
    try {
      await mutateAsync({ runId });
    } catch (error) {
      const e = error as { statusCode?: number; message?: string } | undefined;
      if (e?.statusCode === 409) {
        toast({
          title: 'Someone already picked up this run.',
          status: 'warning',
          isClosable: true,
        });
      } else {
        toast({
          title: e?.message || 'Could not pick up this run.',
          status: 'error',
          isClosable: true,
        });
      }
      return;
    }
    navigate(certificationReviewPath(runId));
  };

  return (
    <Tooltip label={isDisabled ? disabledReason : undefined} isDisabled={!isDisabled}>
      <span>
        <Button
          size="sm"
          colorScheme="primary"
          isLoading={isPending}
          isDisabled={isDisabled}
          onClick={pickUp}
        >
          Pick up
        </Button>
      </span>
    </Tooltip>
  );
};
