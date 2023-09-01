import { ChakraComponent, Icon, Table, Tbody, Td, Th, Thead, Tr, chakra } from '@chakra-ui/react';
import { flexRender } from '@tanstack/react-table';
import { BsFunnel } from 'react-icons/bs';
import { useSbaaTableContext } from './SbaaTableProvider';

type TableComponent = ChakraComponent<'table'>;

export const SbaaTable: TableComponent = (props) => {
  const { children, ...rest } = props;
  const { table } = useSbaaTableContext();
  if (!table) {
    return null as any;
  }

  return (
    <Table {...rest}>
      <Thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <Tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              return (
                <Th
                  key={header.id}
                  colSpan={header.colSpan}
                  cursor={header.column.getCanSort() ? 'pointer' : 'default'}
                  onClick={header.column.getToggleSortingHandler()}
                  userSelect="none"
                >
                  {header.isPlaceholder ? null : (
                    <>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <>&nbsp;&#9650;</>,
                        desc: <>&nbsp;&#9660;</>,
                      }[header.column.getIsSorted() as string] ?? (
                        <chakra.span visibility="hidden">&nbsp;&#9660;</chakra.span>
                      )}
                      {header.column.getIsFiltered() ? (
                        <>
                          &nbsp;
                          <Icon size="xs" mb="-2px" as={BsFunnel} />
                        </>
                      ) : (
                        <chakra.span visibility="hidden">&nbsp;&#9660;</chakra.span>
                      )}
                    </>
                  )}
                </Th>
              );
            })}
          </Tr>
        ))}
      </Thead>
      <Tbody>
        {table.getRowModel().rows.map((row) => {
          return (
            <Tr
              key={row.id}
              aria-selected={row.getIsSelected()}
              onClick={row.getToggleSelectedHandler()}
            >
              {row.getVisibleCells().map((cell) => {
                return (
                  <Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Td>
                );
              })}
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};
