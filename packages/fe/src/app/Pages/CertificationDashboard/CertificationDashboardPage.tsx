import {
  Box,
  Button,
  SimpleGrid,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  useToast,
} from '@chakra-ui/react';
import { ContentSection, PageContentCard, PageTemplate } from '@edanalytics/common-ui';
import {
  CERT_REVIEW_QUEUE_STATUSES,
  CERT_RUN_STATUS,
  CertificationDashboardRunDto,
} from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router';
import { AuthorizeConfig, authorize, usePrivilegeCacheForConfig } from '../../helpers';
import { usePickUpCertificationRun } from '../CertificationReview/useCertificationReview';
import { REVIEW_CERTIFICATION } from '../CertificationReview/reviewAuthorization';
import { certificationReviewPath } from '../../routes/paths';
import { CertificationRunsCard } from './CertificationRunsCard';
import { useCertificationDashboard } from './useCertificationDashboard';

const TITLE = 'Certification dashboard';

const READ_CERTIFICATION: AuthorizeConfig = {
  privilege: 'certification:read',
  subject: { id: '__filtered__' },
};

/** One mutation per row, so each Pick up button shows its own pending state. */
const PickUpButton = ({ runId }: { runId: number }) => {
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
    <Button size="sm" colorScheme="primary" isLoading={isPending} onClick={pickUp}>
      Pick up
    </Button>
  );
};

const renderReviewAction = (row: CertificationDashboardRunDto) => {
  if (row.status === CERT_RUN_STATUS.IN_REVIEW) {
    return (
      <Button
        as={RouterLink}
        to={certificationReviewPath(row.runId)}
        size="sm"
        variant="outline"
        colorScheme="primary"
      >
        Continue
      </Button>
    );
  }
  if (CERT_REVIEW_QUEUE_STATUSES.includes(row.status)) {
    return <PickUpButton runId={row.runId} />;
  }
  return null;
};

export const CertificationDashboardPage = () => {
  const queryClient = useQueryClient();
  // Until the privilege cache arrives authorize() is false, which must not read as "not allowed".
  const privilegeCache = usePrivilegeCacheForConfig(READ_CERTIFICATION);
  const canRead = authorize({ queryClient, config: READ_CERTIFICATION });
  usePrivilegeCacheForConfig(REVIEW_CERTIFICATION);
  const canReview = authorize({ queryClient, config: REVIEW_CERTIFICATION });
  const { data, error, isLoading, dataUpdatedAt } = useCertificationDashboard(canRead);

  // A failed privilege-cache request is not a denial either: show the real error.
  const privilegeCacheError = privilegeCache.find((cache) => cache.error)?.error;
  if (privilegeCacheError) {
    throw privilegeCacheError;
  }

  if (privilegeCache.some((cache) => cache.isLoading)) {
    return (
      <PageTemplate title={TITLE}>
        <Spinner />
      </PageTemplate>
    );
  }

  if (!canRead) {
    // Caught by the route errorElement (ErrorFallback), which displays the message.
    throw new Error('Not allowed');
  }

  if (error) {
    // A failed request is not a denial: show the real error, not "Not allowed".
    throw error;
  }

  if (isLoading || !data) {
    return (
      <PageTemplate title={TITLE}>
        <Spinner />
      </PageTemplate>
    );
  }

  const { counts, waiting, others } = data;
  const cards = [
    { label: 'Newly Ready for Review', value: counts.newlyReadyForReview },
    { label: 'Ready for review with new changes', value: counts.readyWithNewChanges },
    { label: 'Picked up', value: counts.pickedUp },
    { label: 'Runs in flight', value: counts.runsInFlight },
  ];

  return (
    <PageTemplate title={TITLE} customPageContentCard>
      <PageContentCard>
        <ContentSection heading="Review status">
          <Text color="gray.600" mb={4}>
            Accurate as of page load — {new Date(dataUpdatedAt).toLocaleString()}
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
            {cards.map(({ label, value }) => (
              <Box key={label} borderWidth="1px" borderRadius="md" p={4}>
                <Stat>
                  <StatLabel>{label}</StatLabel>
                  <StatNumber>{value}</StatNumber>
                </Stat>
              </Box>
            ))}
          </SimpleGrid>
        </ContentSection>
      </PageContentCard>

      <CertificationRunsCard
        title="Waiting for review"
        list={waiting}
        timeColumn="Waiting"
        emptyMessage="Nothing is waiting for review"
        renderAction={canReview ? renderReviewAction : undefined}
      />
      <CertificationRunsCard
        title="Runs in flight or rejected"
        list={others}
        timeColumn="Last updated"
      />
    </PageTemplate>
  );
};
