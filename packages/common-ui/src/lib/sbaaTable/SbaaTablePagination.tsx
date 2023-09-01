import { Button, ButtonGroup, HStack, Icon, Select, Text } from '@chakra-ui/react';
import React from 'react';
import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import { DivComponent, useSbaaTableContext } from './SbaaTableProvider';

export const SbaaTablePagination: DivComponent = (props) => {
  const { children, ...rest } = props;
  const { table, pageSizes } = useSbaaTableContext();

  if (!table) {
    return null as any;
  }
  return table.getPrePaginationRowModel().rows.length > Math.min(...pageSizes) ? (
    <HStack justify="center" p={4} {...rest}>
      <ButtonGroup size="sm" variant="outline">
        <Button
          w={8}
          borderRadius={'8em'}
          onClick={() => table.setPageIndex(0)}
          isDisabled={!table.getCanPreviousPage()}
        >
          <Icon as={FiChevronsLeft} />
        </Button>
        <Button
          w={8}
          borderRadius={'8em'}
          onClick={() => table.previousPage()}
          isDisabled={!table.getCanPreviousPage()}
        >
          <Icon as={FiChevronLeft} />
        </Button>
      </ButtonGroup>
      <Text>
        {table.getState().pagination.pageIndex + 1}&nbsp;of&nbsp;
        {table.getPageCount()}
      </Text>
      <ButtonGroup size="sm" variant="outline">
        <Button
          w={8}
          borderRadius={'8em'}
          onClick={() => table.nextPage()}
          isDisabled={!table.getCanNextPage()}
        >
          <Icon as={FiChevronRight} />
        </Button>
        <Button
          w={8}
          borderRadius={'8em'}
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          isDisabled={!table.getCanNextPage()}
        >
          <Icon as={FiChevronsRight} />
        </Button>
      </ButtonGroup>
      <Select
        borderRadius={'8em'}
        w={'auto'}
        size="sm"
        value={table.getState().pagination.pageSize}
        onChange={(e) => {
          table.setPageSize(Number(e.target.value));
        }}
      >
        {pageSizes.map((pageSize) => (
          <option key={pageSize} value={pageSize}>
            Show {pageSize}
          </option>
        ))}
      </Select>
    </HStack>
  ) : (
    (null as any)
  );
};
