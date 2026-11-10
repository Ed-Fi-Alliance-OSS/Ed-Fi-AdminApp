import { Spinner } from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { useParams } from 'react-router';
import { useCanSeeCertification } from './useCanSeeCertification';

export const MyProductsPage = () => {
  const { asId } = useParams();
  const { canSee, isLoading, error } = useCanSeeCertification(Number(asId));

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

  return <PageTemplate title="My products" />;
};
