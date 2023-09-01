import { DataTable } from './index';
import { makeData } from './storybook-helpers/helpers';
export default {
  title: 'DataTable',
  component: DataTable,
};

export const Standard = () => (
  <DataTable
    data={makeData(25000)}
    columns={[
      {
        accessorKey: 'firstName',
        cell: (info) => info.getValue(),
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
      },
    ]}
  />
);
