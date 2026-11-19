import { Alert, AlertIcon, Button, Text } from '@chakra-ui/react';
import { useNavigate } from 'react-router';
import { routeDefinitions } from '../../routes/paths';

/**
 * Why the cached run on a review page may be out of date: another reviewer moved it on (a 404),
 * or a refetch failed for another reason and can be retried. Renders nothing otherwise.
 */
export const ReviewRunAlert = ({
  isUnavailable,
  refetchFailed,
  retry,
}: {
  isUnavailable: boolean;
  refetchFailed: boolean;
  retry: () => void;
}) => {
  const navigate = useNavigate();

  if (isUnavailable) {
    return (
      <Alert status="warning" mb={4}>
        <AlertIcon />
        <Text flex="1">This run is no longer available for review.</Text>
        <Button size="sm" onClick={() => navigate(routeDefinitions.certificationDashboard.index)}>
          Back to the Certification dashboard
        </Button>
      </Alert>
    );
  }

  if (refetchFailed) {
    return (
      <Alert status="error" mb={4}>
        <AlertIcon />
        <Text flex="1">This run couldn&apos;t be refreshed. What you see may be out of date.</Text>
        <Button size="sm" onClick={retry}>
          Try again
        </Button>
      </Alert>
    );
  }

  return null;
};
