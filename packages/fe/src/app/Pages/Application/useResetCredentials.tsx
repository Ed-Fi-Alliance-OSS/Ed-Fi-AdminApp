import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  CloseButton,
  Collapse,
  HStack,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  useClipboard,
} from '@chakra-ui/react';
import {
  ApplicationYopassResponseDto,
  GetApplicationDto,
} from '@edanalytics/models';
import { useState } from 'react';
import { BiShieldX } from 'react-icons/bi';
import { useApplicationResetCredential } from '../../api';

export const useResetCredentials = (props: {
  application: undefined | GetApplicationDto;
  sbeId: undefined | number | string;
  tenantId: undefined | number | string;
}) => {
  const { application, sbeId, tenantId } = props;

  const clipboard = useClipboard('');

  const resetCreds = useApplicationResetCredential({
    sbeId: props.sbeId,
    tenantId: props.tenantId,
    callback: (result) => {
      clipboard.setValue(result.link);
    },
  });
  const onClose = () => {
    clipboard.setValue('');
  };
  return [
    () =>
      application ? (
        <Button
          iconSpacing={1}
          leftIcon={
            resetCreds.isLoading ? <Spinner size="sm" /> : <BiShieldX />
          }
          onClick={() => {
            resetCreds.mutate(application);
          }}
        >
          Reset credentials
        </Button>
      ) : null,
    () => (
      <Modal isOpen={clipboard.value !== ''} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Success!</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text as="p">
              Use this one-time link to see your Key and Secret:
            </Text>
            <Link href={clipboard.value} color="blue.600">
              {clipboard.value}
            </Link>
            <Text my={5} as="p" fontStyle="italic">
              Note: this link will work only once, and will expire after 7 days.
            </Text>
          </ModalBody>
        </ModalContent>
      </Modal>
    ),
    () => (
      <Collapse in={clipboard.value !== ''}>
        <Alert
          flexDir="column"
          alignItems="left"
          status="success"
          variant="subtle"
        >
          <HStack mb={3} w="100%">
            <AlertIcon />
            <AlertTitle flexGrow={1} fontSize="lg">
              Reset successful
            </AlertTitle>
            <CloseButton
              alignSelf="flex-start"
              position="relative"
              right={-1}
              top={-1}
              onClick={onClose}
            />
          </HStack>
          <AlertDescription>
            <Text as="b">Use this link to see your new credentials: </Text>
            <Link href={clipboard.value} color="blue.600">
              {clipboard.value}
            </Link>
            <Text my={5} as="p" fontStyle="italic">
              Note: this link will work only once, and will expire after 7 days.
            </Text>
          </AlertDescription>
        </Alert>
      </Collapse>
    ),
  ];
};
