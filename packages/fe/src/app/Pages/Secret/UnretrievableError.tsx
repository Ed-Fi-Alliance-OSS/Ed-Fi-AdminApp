import { chakra, Alert, AlertDescription, AlertIcon, AlertTitle, Tooltip } from '@chakra-ui/react';
import { Icons } from '@edanalytics/common-ui';

export function UnretrievableError() {
  return (
    <Alert
      status="error"
      variant="subtle"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      height="200px"
    >
      <AlertIcon boxSize="40px" mr={0} />
      <AlertTitle mt={4} mb={1} fontSize="lg">
        Credentials not found
      </AlertTitle>
      <AlertDescription maxWidth="sm">
        Each link can only be used once. You can reset the credentials to get a new link.
        <Tooltip label="We delete the credentials after you retrieve them. This way, even if your link gets stolen it will be of no use. Please note that if you or your contact resets the credentials to get a new link, the current ones will no longer work.">
          <chakra.span>
            <Icons.InfoCircle />
          </chakra.span>
        </Tooltip>{' '}
      </AlertDescription>
    </Alert>
  );
}
