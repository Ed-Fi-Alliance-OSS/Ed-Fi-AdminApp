import { Box } from '@chakra-ui/react';
import { Meta } from '@storybook/react';
import { SbaaTable, SbaaTableFilters, SbaaTablePagination, SbaaTableSearch } from '.';
import { makeData } from '../dataTable/storybook-helpers/helpers';
import { SbaaTableProvider } from './SbaaTableProvider';

const meta: Meta<typeof SbaaTableProvider> = {
  title: 'SbaaTable',
  component: SbaaTableProvider,
};
export default meta;

export const Standard = () => (
  <SbaaTableProvider
    data={makeData(25000)}
    columns={[
      {
        accessorKey: 'firstName',
        cell: (info) => info.getValue(),
        header: 'First Name',
      },
      {
        accessorFn: (row) => row.lastName,
        id: 'lastName',
        cell: (info) => info.getValue(),
        header: 'Last Name',
      },
      {
        accessorKey: 'age',
        header: 'Age',
      },
      {
        accessorKey: 'visits',
        header: 'Visits',
        meta: {
          type: 'number',
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
      },
      {
        accessorKey: 'progress',
        header: 'Profile Progress',
      },
      {
        accessorKey: 'createdAt',
        header: 'Created At',
        meta: {
          type: 'date',
        },
      },
    ]}
  >
    <Box mb={10}>
      <SbaaTableSearch />
      <SbaaTableFilters />
    </Box>
    <SbaaTable />
    <SbaaTablePagination />
  </SbaaTableProvider>
);
