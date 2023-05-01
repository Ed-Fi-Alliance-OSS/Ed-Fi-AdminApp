import { HStack, Flex, Box } from '@chakra-ui/layout';
import { Outlet } from '@tanstack/router';
import { Breadcrumbs } from './Breadcrumbs';
import { Nav } from './Nav';
import { TenantNav } from './TenantNav';

export const TenantLayout = () => (
  <HStack
    as="main"
    w="100%"
    flex="auto 1 1"
    align="start"
    overflow="hidden"
    spacing={0}
  >
    <Box
      p={3}
      px="calc(3vw + 0.5em)"
      maxH="100%"
      h="100%"
      overflow="auto"
      flexGrow="1"
    >
      <Flex flexDir="column" minW="35em" h="100%">
        <Breadcrumbs mb={3} />
        <Box flexGrow={1}>
          <Outlet />
        </Box>
      </Flex>
    </Box>
  </HStack>
);
