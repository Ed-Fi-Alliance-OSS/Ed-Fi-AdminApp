import {
  Box,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  UnorderedList,
  useToast,
} from '@chakra-ui/react';
// import { OperationResultDto, OperationStatusDto } from '@edanalytics/models';
import { OperationResultDto } from '@edanalytics/models';
import { useState } from 'react';
import { SuccessFailureBadge } from '../SuccessFailureBadge';

// TODO: remove TempResultDto
// TODO: fix OperationResultDto
// TODO: add OperationStatusDto
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TempResultDto = OperationResultDto & { messages: any; statuses: any };

/**
 * Display standard operation status DTO. Make sure to put the
 * returned `<ModalRoot />` somewhere unless you only use the Toast.
 * */
export const useOperationResultDisclosure = () => {
  const toast = useToast();
  const [modalResultState, setModalResultState] = useState<OperationResultDto | null>(null);
  const popModal = (result: OperationResultDto) => setModalResultState(result);
  const closeModal = () => setModalResultState(null);
  const modalIsOpen = modalResultState !== null;

  const buildResult = (result: OperationResultDto) => {
    let { messages } = result as TempResultDto;
    const { succeeded, failed } = (result as TempResultDto).statuses.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (totals: any, status: any) => {
        totals[status.success ? 'succeeded' : 'failed'].push(status);
        return totals;
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        succeeded: [] as any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        failed: [] as any[],
        // succeeded: [] as OperationStatusDto[],
        // failed: [] as OperationStatusDto[],
      }
    );
    if (succeeded.length && !failed.length) {
      // Clear messages if all successful
      messages = [];
    }
    const totalSuccess = succeeded.length && !failed.length;
    const successConfig = totalSuccess
      ? { colorScheme: 'green', time: 7000 }
      : succeeded.length
      ? { colorScheme: 'yellow', time: 14000 }
      : failed.length
      ? { colorScheme: 'red', time: 16000 }
      : { colorScheme: 'blue', time: 12000 };

    return {
      totalSuccess,
      indeterminate: !succeeded.length && !failed.length,
      colorScheme: successConfig.colorScheme,
      duration: successConfig.time,
      title: result.title,
      body: (
        <Box>
          {succeeded.length || failed.length ? (
            <>
              {messages.length ? <Text>Statuses:</Text> : null}
              <UnorderedList styleType="circle">
                {[...succeeded, ...failed].map((status) => (
                  <ListItem my={1} display="list-item" key={status.name}>
                    {status.name}&nbsp;
                    <SuccessFailureBadge bool={status.success} pastTense />
                  </ListItem>
                ))}
              </UnorderedList>
            </>
          ) : null}
          {messages.length ? (
            <>
              {succeeded.length || failed.length ? <Text>Messages:</Text> : null}
              <UnorderedList styleType="circle">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {messages.map((message: any) => (
                  <ListItem my={1} display="list-item" key={message}>
                    {message}
                  </ListItem>
                ))}
              </UnorderedList>
            </>
          ) : null}
        </Box>
      ),
    };
  };
  const popToast = (result: OperationResultDto) => {
    const baseConfig = buildResult(result);
    toast({
      colorScheme: baseConfig.colorScheme,
      duration: baseConfig.duration,
      title: result.title,
      isClosable: true,
      description: baseConfig.body,
    });
  };

  return {
    /** Automatically display Toast for success and Modal for error or partial error. */
    disclose: (result: OperationResultDto) => {
      const baseConfig = buildResult(result);
      if (baseConfig.totalSuccess || baseConfig.indeterminate) {
        popToast(result);
      } else {
        popModal(result);
      }
    },
    popModal,
    popToast,
    /** Add this empty component somewhere. It's where the Modal gets instantiated, and if it doesn't exist then the modal won't show. */
    ModalRoot: () => {
      const baseConfig = modalResultState ? buildResult(modalResultState) : null;
      return (
        <Modal isOpen={modalIsOpen} onClose={closeModal}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader
              borderTopStyle="solid"
              borderTopWidth="6px"
              borderTopRadius="base"
              borderTopColor={`${baseConfig?.colorScheme}.500`}
            >
              {baseConfig?.title}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>{baseConfig?.body}</ModalBody>
          </ModalContent>
        </Modal>
      );
    },
  };
};
