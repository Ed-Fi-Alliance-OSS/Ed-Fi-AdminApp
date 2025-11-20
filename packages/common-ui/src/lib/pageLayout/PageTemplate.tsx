import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  BoxProps,
  ChakraComponent,
  HStack,
  Heading,
  Text,
  chakra,
} from '@chakra-ui/react';
import { standardizeError } from '@edanalytics/models';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ActionGroup } from '..';

/**
 * Standard page template
 *
 * There is a CSS class to de-radius the upper right corner of any children with the `.page-content-card` class whenever the page actions are not empty.
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
  customPageContentCard?: boolean;
}) => {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <Box
      mx="-0.5rem"
      w="fit-content"
      minW="100%"
      px="0.5rem"
      css={{
        '&:has(.page-actions .chakra-button)>div.page-content-card': {
          borderTopRightRadius: '0',
        },
        '&:has(.page-actions .chakra-button)>div.page-content-card ~ div.page-content-card': {
          borderTopRightRadius: 'var(--chakra-radii-md)',
        },
      }}
    >
      <HStack alignItems="end" justify="space-between" pr="1px">
        <Heading mb={2} whiteSpace="nowrap" color="gray.700" size="page-heading">
          {props.title ?? <>&nbsp;</>}
        </Heading>
        <ErrorBoundary
          onReset={reset}
          FallbackComponent={() => (
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
              // Using first-child causes an error so this and the sibling selector are used instead
              // [class] is needed for precedence purposes
              '& > *[class]': {
                borderTopLeftRadius: 'var(--chakra-radii-md)',
              },
              '& > *:last-child': {
                borderTopRightRadius: 'var(--chakra-radii-md)',
              },
              '& > * + *[class]': {
                borderLeftWidth: '1px',
                borderTopLeftRadius: 0,
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
        onReset={reset}
        FallbackComponent={(arg) => {
          const error = standardizeError(arg.error);
          return (
            <Box mr="1px">
              <Alert status="error">
                <AlertIcon />
                <HStack flexGrow={1} alignItems="baseline">
                  <AlertTitle>{error.title}</AlertTitle>
                  <AlertDescription>{error.message || null}</AlertDescription>
                </HStack>
              </Alert>
            </Box>
          );
        }}
      >
        {props.customPageContentCard ? (
          props.children
        ) : (
          <PageContentCard className="page-content-card">{props.children}</PageContentCard>
        )}
      </ErrorBoundary>
    </Box>
  );
};

type DivComponent = ChakraComponent<'div', object>;

export const PageContentCard = ((props: BoxProps) => (
  <chakra.div
    {...{
      mb: 6,
      boxShadow: 'lg',
      border: '1px solid',
      borderColor: 'gray.200',
      borderRadius: 'md',
      bg: 'foreground-bg',
      minW: '100%',
      w: 'fit-content',
      p: '1.5em',
      className: 'page-content-card',
      ...props,
    }}
    css={{
      '& .content-section:not(:last-child)': {
        marginBottom: 'var(--chakra-space-10)',
      },
    }}
  />
)) as DivComponent;
