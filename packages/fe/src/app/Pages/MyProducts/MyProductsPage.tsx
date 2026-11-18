import { SimpleGrid, Spinner, Text, useDisclosure } from '@chakra-ui/react';
import { Icons, PageActions, PageTemplate } from '@edanalytics/common-ui';
import { useParams } from 'react-router';
import { DataStoreCard } from './DataStoreCard';
import { RequestCertificationModal } from './RequestCertificationModal';
import { TeamDashboardSummaryCards } from './TeamDashboardSummaryCards';
import { useCanSeeCertification } from './useCanSeeCertification';
import { useTeamCertificationDashboard } from './useTeamCertificationDashboard';

export const MyProductsPage = () => {
  const { asId } = useParams();
  const teamId = Number(asId);
  const { canSee, canRun, isLoading, error } = useCanSeeCertification(teamId);
  const requestModal = useDisclosure();
  // Called before the early returns below; it only fetches once the user is known to have access.
  const dashboard = useTeamCertificationDashboard(teamId, canSee);

  if (isLoading) {
    return (
      <PageTemplate title="My products">
        <Spinner />
      </PageTemplate>
    );
  }

  if (error) {
    // A failed access check is not a denial: show the real error, not "Not allowed".
    throw error;
  }

  if (!canSee) {
    // Caught by the route errorElement (ErrorFallback), which displays the message.
    throw new Error('Not allowed');
  }

  if (dashboard.error) {
    // A failed request is not a denial: show the real error, not "Not allowed".
    throw dashboard.error;
  }

  if (dashboard.isLoading || !dashboard.data) {
    return (
      <PageTemplate title="My products">
        <Spinner />
      </PageTemplate>
    );
  }

  const { counts, dataStores } = dashboard.data;
  const isEmpty = dataStores.length === 0;

  return (
    <PageTemplate
      title="My products"
      // Starting a run needs certification:run, which a read-only role doesn't have.
      actions={
        canRun ? (
          <PageActions
            actions={{
              Request: {
                icon: Icons.Plus,
                text: 'Request New Certification',
                title: 'Request a new certification.',
                onClick: requestModal.onOpen,
              },
            }}
          />
        ) : undefined
      }
    >
      {!canRun && (
        <Text color="gray.600">
          You can view certifications for your team, but your role can&apos;t start a certification
          run.
        </Text>
      )}
      <TeamDashboardSummaryCards counts={isEmpty ? null : counts} />
      {isEmpty ? (
        <Text color="gray.600" mt={6}>
          No certification runs yet.
          {canRun && ' Use Request New Certification to start your first one.'}
        </Text>
      ) : (
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} mt={6}>
          {dataStores.map((dataStore) => (
            <DataStoreCard
              key={`${dataStore.edfiTenantId}:${dataStore.odsId}`}
              teamId={teamId}
              dataStore={dataStore}
            />
          ))}
        </SimpleGrid>
      )}
      {/* Mounted only while open, so each opening starts empty and refetches the open runs. */}
      {requestModal.isOpen && (
        <RequestCertificationModal teamId={teamId} onClose={requestModal.onClose} />
      )}
    </PageTemplate>
  );
};
