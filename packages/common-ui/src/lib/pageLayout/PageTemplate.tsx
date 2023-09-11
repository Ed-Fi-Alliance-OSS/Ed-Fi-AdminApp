import { Alert, AlertIcon, Box, HStack, Heading, Text, chakra } from '@chakra-ui/react';
import { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ActionGroup } from '..';

/**
 * Standard page template
 *
 * There is a CSS class to de-radius the upper right corner of any children with the `.content-card` class whenever the page actions are not empty.
 */
export const PageTemplate = (props: {
  title?: ReactNode;
  children?: ReactNode;
  /**
   * @deprecated doesn't do anything. Set width within your content instead.
   */
  constrainWidth?: boolean;
  justifyActionsLeft?: boolean;
  actions?: ReactNode;
  customContentBox?: boolean;
}) => {
  return (
    <Box
      mx="-0.5rem"
      w="fit-content"
      minW="100%"
      px="0.5rem"
      css={{
        '&:has(.page-actions .chakra-button) .content-card': {
          borderTopRightRadius: '0',
        },
      }}
    >
      <HStack alignItems="end" justify="space-between" pr="1px">
        <Heading mb={2} whiteSpace="nowrap" color="gray.700" size="page-heading">
          {props.title ?? <>&nbsp;</>}
        </Heading>
        <ErrorBoundary
          FallbackComponent={(arg: { error: { message: string } }) => (
            <Text as="i" color="gray.500" fontSize="sm">
              Unable to show actions
            </Text>
          )}
        >
          <ActionGroup
            zIndex={0}
            className="page-actions"
            css={{
              '& > a': {
                borderRadius: 0,
              },
              '& > button': {
                borderRadius: 0,
              },
              /*
              React doesn't like this selector bc of SSR, but
              we aren't doing SSR, and the preferred alternative
              (:first-of-type) doesn't work here because we have
              both <a> and <button> children
              */
              '& > *:first-child': {
                borderTopLeftRadius: 'var(--chakra-radii-md)',
              },
              '& > *:last-child': {
                borderTopRightRadius: 'var(--chakra-radii-md)',
              },
              '& > *:not(:first-child)': {
                borderLeftWidth: '1px',
              },
            }}
            isAttached
            p={0}
            m={0}
          >
            {props.actions}
          </ActionGroup>
        </ErrorBoundary>
      </HStack>
      <ErrorBoundary
        FallbackComponent={(arg: { error: { message: string } }) => (
          <Box mr="1px">
            <Alert status="error">
              <AlertIcon />
              {arg.error.message}
            </Alert>
          </Box>
        )}
      >
        {props.customContentBox ? (
          props.children
        ) : (
          <PageContentPane className="content-card">{props.children}</PageContentPane>
        )}
      </ErrorBoundary>
    </Box>
  );
};

export const PageContentPane = chakra('div', {
  baseStyle: {
    boxShadow: 'lg',
    border: '1px solid',
    borderColor: 'gray.200',
    borderRadius: 'md',
    bg: 'foreground-bg',
    minW: '100%',
    w: 'fit-content',
    p: '1.5em',
    '& .content-section:not(:last-child)': {
      mb: 10,
    },
  },
});
