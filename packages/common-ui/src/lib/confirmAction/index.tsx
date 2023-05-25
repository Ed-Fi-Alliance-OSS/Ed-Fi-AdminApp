import { useDisclosure } from '@chakra-ui/hooks';
import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from '@chakra-ui/react';
import { createContext } from '@chakra-ui/react-context';
import { DOMElement, PropGetter } from '@chakra-ui/react-types';
import { mergeRefs } from '@chakra-ui/react-use-merge-refs';
import { forwardRef } from '@chakra-ui/system';
import { MouseEventHandler, useRef } from 'react';

interface UseConfirmActionProps {
  skipConfirmation?: boolean;
  isDisabled?: boolean;
  bodyText?: string;
  headerText: string;
  yesButtonText?: string;
  noButtonText?: string;
  action?: undefined | (() => Promise<void> | void);
}

export const useConfirmAction = (
  props: UseConfirmActionProps = {
    headerText: 'Do the thing?',
    action: () => undefined,
  }
) => {
  const {
    bodyText,
    headerText,
    yesButtonText,
    noButtonText,
    action,
    skipConfirmation,
    isDisabled,
  } = props;
  const { isOpen, onOpen, onClose } = useDisclosure();
  const onClick = async () => {
    action && action();
    onClose();
  };

  const buttonRef = useRef<HTMLButtonElement>(null);

  const getModalProps: PropGetter<
    object,
    ModalProps &
      Pick<
        UseConfirmActionProps,
        'bodyText' | 'action' | 'headerText' | 'yesButtonText' | 'noButtonText'
      >
  > = (props = {}, ref = null) => ({
    children: undefined,
    ...props,
    isOpen,
    onClose,
    bodyText,
    headerText,
    noButtonText,
    yesButtonText,
    action: onClick,
  });

  const getButtonProps: PropGetter = (props = {}, ref = null) => ({
    ...props,
    ref: mergeRefs(ref, buttonRef),
    onClick: isDisabled ? undefined : skipConfirmation ? action : onOpen,
  });

  return {
    getModalProps,
    getButtonProps,
    isOpen,
  };
};

type UseConfirmActionReturn = ReturnType<typeof useConfirmAction>;

const [ConfirmActionProvider, useConfirmActionContext] =
  createContext<UseConfirmActionReturn>({
    name: 'confirmActionContext',
    errorMessage:
      'useConfirmActionContext: `context` is undefined. Seems you forgot to wrap your button within <ConfirmAction/>',
  });

export interface ConfirmActionProps extends UseConfirmActionProps {
  children: (props: {
    onClick?: MouseEventHandler<DOMElement>;
  }) => React.ReactNode;
}

export const ConfirmAction = (props: ConfirmActionProps) => {
  const { children, ...ownProps } = props;

  const context = useConfirmAction(ownProps);

  return (
    <ConfirmActionProvider value={context}>
      <ConfirmActionModal />
      {typeof children === 'function'
        ? children(context.getButtonProps())
        : children}
    </ConfirmActionProvider>
  );
};

export const ConfirmActionModal = forwardRef<object, 'div'>(
  function ConfirmActionModal(props, ref) {
    const { getModalProps } = useConfirmActionContext();
    const {
      headerText,
      bodyText,
      action,
      yesButtonText,
      noButtonText,
      onClose,
      ...modalProps
    } = getModalProps(props, ref);

    return (
      <Modal onClose={onClose} {...modalProps}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{headerText}</ModalHeader>
          <ModalCloseButton />
          {bodyText ? <ModalBody>{bodyText}</ModalBody> : null}
          <ModalFooter>
            <Button
              size="md"
              variant="solid"
              colorScheme="blue"
              mr={3}
              onClick={action}
            >
              {yesButtonText ?? 'Yes'}
            </Button>
            <Button size="md" variant="ghost" onClick={onClose}>
              {noButtonText ?? 'No'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }
);
