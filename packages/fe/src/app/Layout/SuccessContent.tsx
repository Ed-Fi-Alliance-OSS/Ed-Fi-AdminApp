import { Box } from '@chakra-ui/react';
import { Outlet } from '@tanstack/router';
import { Breadcrumbs } from './Breadcrumbs';

export const SuccessContent = () => (
  <>
    <Breadcrumbs mb={3} />
    <Box flexGrow={1}>
      <Outlet />
    </Box>
  </>
);
