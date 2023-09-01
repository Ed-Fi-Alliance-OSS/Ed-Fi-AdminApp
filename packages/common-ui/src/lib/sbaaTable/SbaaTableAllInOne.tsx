import { Box, HStack } from '@chakra-ui/react';
import { SbaaTable } from './SbaaTable';
import { SbaaTableFilters } from './SbaaTableFilters';
import { SbaaTablePagination } from './SbaaTablePagination';
import { SbaaTableProvider } from './SbaaTableProvider';
import { SbaaTableSearch, SbaaTableAdvancedButton } from './SbaaTableSearch';

export const SbaaTableAllInOne: typeof SbaaTableProvider = (props) => (
  <SbaaTableProvider {...props}>
    <Box mb={4}>
      <HStack align="end">
        <SbaaTableSearch />
        <SbaaTableAdvancedButton />
      </HStack>
      <SbaaTableFilters mb={4} />
    </Box>
    <SbaaTable />
    <SbaaTablePagination />
  </SbaaTableProvider>
);
