import { Box, HStack, Link, Text, VStack } from '@chakra-ui/react';
import { useRouteError } from 'react-router';

export const ErrorFallback = () => {
  const message = (useRouteError() as Error)?.message ?? 'Not found';
  return (
    <Box pt="30vh" textAlign="center" px="5em">
      <VStack
        borderRadius="md"
        border="1px solid"
        borderColor="gray.400"
        py="4em"
        pb="8em"
        px="6em"
        display="inline-flex"
        align="left"
        textAlign="left"
        spacing="4em"
      >
        <HStack>
          <Link
            flex="30% 1 1"
            as="span"
            onClick={() => {
              window.history.back();
            }}
          >
            &larr; Back
          </Link>
          <Link textAlign="center" href="/" flex="30% 1 1">
            Home
          </Link>
          <Link textAlign="right" href={window.location.href} flex="30% 1 1">
            Refresh &#x21BB;
          </Link>
        </HStack>
        <Text w="auto" textAlign="center" fontWeight="bold" fontSize="5xl" color="gray.400">
          {message}
        </Text>
      </VStack>
    </Box>
  );
};
