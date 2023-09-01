import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Heading,
  Icon,
  Text,
  Tooltip,
  VStack,
  chakra,
  useBoolean,
} from '@chakra-ui/react';
import { ConfirmAction, JsonSecret, SecretValue } from '@edanalytics/common-ui';
import { useEffect, useState } from 'react';
import { BsInfoCircle } from 'react-icons/bs';
import { useLocation } from 'react-router-dom';
import { getMessage } from '../../helpers';

const placeholder = `KEY:
123abc123abc

SECRET:
123abc123abc123abc123abc

URL:
https://gbes-infinite-campus.mth-dev-61a.eaedfi.edanalytics.org/
`;

export const SecretPage = () => {
  const { hash } = useLocation();
  const [hashMark, uuid, key] = hash.split('/');
  const [secret, setSecret] = useState<string | null>(null);
  let secretJson: null | JsonSecret = null;
  if (secret !== null) {
    try {
      secretJson = JSON.parse(secret);
      if (
        !(
          secretJson &&
          typeof secretJson.key === 'string' &&
          typeof secretJson.secret === 'string' &&
          typeof secretJson.url === 'string'
        )
      ) {
        throw new Error('Retrieved secret not valid');
      }
    } catch (NotJson) {
      // that's fine, it's just old format pre-JSON.
    }
  }
  const [show, setShow] = useBoolean(false);
  const [isError, setIsError] = useBoolean(false);

  useEffect(() => {
    const func = async () => {
      if (uuid && key && show && !secret) {
        try {
          const secret = await getMessage(uuid, key);
          setSecret(secret.data.toString());
        } catch (error) {
          if (error === 404) {
            setIsError.on();
          }
        }
      }
    };
    func();
  }, [uuid, key, show]);
  return (
    <VStack p={10} bg="background-bg">
      <Box w="100%" maxW="50em">
        <Heading mb={4} fontSize="xl">
          Retrieve credentials
        </Heading>
        <ConfirmAction
          headerText="Retrieve now?"
          bodyText="The link will only work once. After that, the credentials are deleted and you will have to reset them in order to get another link. This is for extra security."
          yesButtonText="Yes, retrieve them."
          noButtonText="No, not right now."
          isDisabled={show || isError}
          action={() => {
            setShow.on();
          }}
        >
          {(confirmRenderProps) => (
            <Box
              {...confirmRenderProps}
              p={5}
              minH="15em"
              borderRadius="md"
              border="1px"
              borderColor="gray.200"
              boxShadow="lg"
              css={
                show
                  ? {}
                  : {
                      cursor: 'pointer',
                    }
              }
              _hover={
                show
                  ? undefined
                  : {
                      background: 'gray.50',
                    }
              }
              pos="relative"
            >
              {show ? null : (
                <Box pos="absolute" left="50%" top="50%">
                  <Text
                    fontWeight="medium"
                    fontSize="lg"
                    w="auto"
                    textAlign="center"
                    transform="translate(-50%, -50%)"
                  >
                    Click to retrieve credentials
                  </Text>
                </Box>
              )}
              {isError ? (
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
                    Each link can only be used once. You can reset the credentials to get a new
                    link.
                    <Tooltip label="We delete the credentials after you retrieve them. This way, even if your link gets stolen it will be of no use. Please note that if you or your contact resets the credentials to get a new link, the current ones will no longer work.">
                      <chakra.span>
                        <Icon as={BsInfoCircle} />
                      </chakra.span>
                    </Tooltip>{' '}
                  </AlertDescription>
                </Alert>
              ) : show && secretJson ? (
                <SecretValue secret={secretJson} />
              ) : (
                <chakra.pre
                  fontSize="lg"
                  css={
                    show
                      ? {}
                      : {
                          userSelect: 'none',
                          opacity: '0.7',
                          filter: 'blur(0.5rem)',
                        }
                  }
                >
                  {show ? secret : placeholder}
                </chakra.pre>
              )}
            </Box>
          )}
        </ConfirmAction>
      </Box>
    </VStack>
  );
};
