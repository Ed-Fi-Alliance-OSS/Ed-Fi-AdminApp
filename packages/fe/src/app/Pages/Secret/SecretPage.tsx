import { useMatch, useParams } from '@tanstack/router';
import { secretRoute } from '../../routes/secret.routes';
import { useEffect, useState } from 'react';
import { getMessage } from '../../helpers';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Heading,
  Icon,
  Text,
  Tooltip,
  VStack,
  chakra,
  useBoolean,
} from '@chakra-ui/react';
import { useMe } from '../../api';
import { InfoIcon } from '@chakra-ui/icons';
import { BiInfoCircle } from 'react-icons/bi';
import { BsInfoCircle } from 'react-icons/bs';
import { ConfirmAction, ConfirmActionProps } from '@edanalytics/common-ui';

const placeholder = `KEY:
123abc123abc

SECRET:
123abc123abc123abc123abc`;

export const SecretPage = () => {
  const params = useParams({ from: secretRoute.id });
  const [secret, setSecret] = useState<string | null>(null);
  const [show, setShow] = useBoolean(false);
  const [isError, setIsError] = useBoolean(false);
  const me = useMe();

  useEffect(() => {
    const func = async () => {
      if (params.uuid && params.key && show && !secret) {
        try {
          const secret = await getMessage(params.uuid, params.key);
          setSecret(secret.data.toString());
        } catch (error) {
          if (error === 404) {
            setIsError.on();
          }
        }
      }
    };
    func();
  }, [params.uuid, params.key, show]);
  return (
    <VStack p={10}>
      <Box w="100%" maxW="40em">
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
              borderRadius="4px"
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
                    Each link can only be used once. You can reset the
                    credentials to get a new link.
                    <Tooltip label="We delete the credentials after you retrieve them. This way, even if your link gets stolen it will be of no use. Please note that if you or your contact resets the credentials to get a new link, the current ones will no longer work.">
                      <chakra.span>
                        <Icon as={BsInfoCircle} />
                      </chakra.span>
                    </Tooltip>{' '}
                  </AlertDescription>
                </Alert>
              ) : (
                <chakra.pre
                  fontSize="lg"
                  css={
                    show
                      ? {}
                      : {
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
