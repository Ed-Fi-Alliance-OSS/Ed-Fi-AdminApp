import { Box, Flex, HStack, Text, VStack } from '@chakra-ui/react';
import { useAtomValue } from 'jotai';
import { Outlet, useParams } from 'react-router-dom';
import { useMe } from '../api';
import { NavContextProvider } from '../helpers';
import { AppBar } from './AppBar';
import { AppBarPublic } from './AppBarPublic';
import { Breadcrumbs } from './Breadcrumbs';
import { FeedbackBanners } from './FeedbackBanner';
import { LandingLayout, LandingLayoutRouteElement } from './LandingLayout';
import { Nav, asTenantIdAtom } from './Nav';

export const StandardLayout = () => {
  const me = useMe();
  const isLoggedIn = me.data !== undefined && me.data !== null;
  const hasRole = !!me.data?.role;
  const asId = useAtomValue(asTenantIdAtom);
  const params = useParams();

  return (
    <NavContextProvider asId={asId} sbeId={'sbeId' in params ? Number(params.sbeId) : undefined}>
      <VStack spacing={0} h="100vh" overflow="hidden">
        {isLoggedIn ? <AppBar /> : <AppBarPublic />}
        <HStack as="main" w="100%" flex="auto 1 1" align="start" overflow="hidden" spacing={0}>
          {hasRole ? (
            <>
              <Nav />
              <Box
                boxShadow="inner-md"
                border="1px solid"
                borderColor="gray.200"
                borderTopLeftRadius="md"
                bg="background-bg"
                maxH="100%"
                h="100%"
                overflow="auto"
                flexGrow="1"
              >
                <Flex flexDir="column" minW="35em" h="100%">
                  <FeedbackBanners />
                  <Box p={3} display="flex" flexDir="column" flexGrow={1} px="calc(4vw + 0.5em)">
                    <Breadcrumbs mb={5} />
                    <Box flexGrow={1} pb="2em" w="fit-content" minW="100%">
                      {/* asId might be one render behind */}
                      {params.asId && asId === undefined ? null : <Outlet />}
                    </Box>
                    <Box fontSize="sm" color="gray.600" mt="auto" textAlign="center">
                      ©2023 Education Analytics, Inc. All Rights Reserved
                    </Box>
                  </Box>
                </Flex>
              </Box>
            </>
          ) : isLoggedIn ? (
            <LandingLayout>
              <Text
                p="1em"
                fontSize="2xl"
                fontWeight={500}
                color="gray.700"
                textAlign="center"
                maxW="30em"
              >
                We found you in our database, but you don't have a role assigned yet.
              </Text>
            </LandingLayout>
          ) : me.isLoading ? null : (
            <LandingLayoutRouteElement />
          )}
        </HStack>
      </VStack>
    </NavContextProvider>
  );
};
