import { Spinner, useDisclosure } from '@chakra-ui/react';
import { Icons, PageActions, PageTemplate } from '@edanalytics/common-ui';
import { useParams } from 'react-router';
import { RequestCertificationModal } from './RequestCertificationModal';
import { useCanSeeCertification } from './useCanSeeCertification';

export const MyProductsPage = () => {
  const { asId } = useParams();
  const teamId = Number(asId);
  const { canSee, isLoading, error } = useCanSeeCertification(teamId);
  const requestModal = useDisclosure();

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

  // The page is almost empty for now: the product cards come with AC-671.
  return (
    <PageTemplate
      title="My products"
      actions={
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
      }
    >
      {/* Mounted only while open, so each opening starts empty and refetches the open runs. */}
      {requestModal.isOpen && (
        <RequestCertificationModal teamId={teamId} onClose={requestModal.onClose} />
      )}
    </PageTemplate>
  );
};
