import {
  Box,
  Button,
  ButtonGroup,
  HStack,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputProps,
  InputRightElement,
  Select,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  chakra,
  forwardRef,
} from '@chakra-ui/react';
import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  RowSelectionState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import React, { useMemo } from 'react';
import { BiSearch } from 'react-icons/bi';
import { BsX } from 'react-icons/bs';
import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';

import { rankItem } from '@tanstack/match-sorter-utils';

export const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  // Rank the item
  const itemRank = rankItem(row.getValue(columnId), value);

  // Store the itemRank info
  addMeta({
    itemRank,
  });

  // Return if the item should be filtered in/out
  return itemRank.passed;
};
/**
 * Wrapper around @tanstack/react-table.
 *
 * Uses Chakra-UI table with no style overrrides (e.g. just plain old themed Chakra table).
 *
 * Notes:
 * - Sorting is done automatically. The `accessorKey` or `accessorFn` column attributes therefore need to yield the value to be sorted (even if you want a custom `cell` render property, you'll still need to provide an appropriate accessor).
 * - Use the `getRelationDisplayName()` helper function to conveniently build a `accessorFn` which returns the display value.
 * - The `data` and `columns` props are passed through to react-table unchanged, so feel free to use the full react-table API.
 * - Pagination, sorting, and filtering state are all stored in the URL, with the key prefix provided.
 *
 * @example <caption>column config for basic text value</caption>
 * ({
 *   accessorKey: 'name',
 *   header: 'Name',
 * })
 *
 * @example <caption>Column config for transformed value</caption>
 * ({
 *   accessorFn: (info) => shortDate(info.createdDate),
 *   header: 'Created Date',
 * })
 *
 * @example <caption>Column config for custom cell</caption>
 * // Make sure to put the transformation in the accessor so that it gets used for sorting, even if you also have a custom renderer.
 * ({
 *   accessorFn: (info) => shortDate(info.createdDate),
 *   cell: (info) => (
       <Text color="gray.500">{info.getValue()}</Text>
     ),
 *   header: 'Created Date',
 * })
 *
 * @example <caption>Column config for basic text value</caption>
 * ({
 *     accessorKey: 'name',
 *     header: 'Name',
 * })
 */
export function DataTable<T extends object>(props: {
  data: T[] | IterableIterator<T>;
  columns: ColumnDef<T>[];
  enableRowSelection?: boolean;
  pageSizes?: number[];
  queryKeyPrefix?: string | undefined;
}) {
  const data = useMemo(() => [...props.data], [props.data]);
  const columns = props.columns;
  const pageSizes = props.pageSizes ?? [10, 25, 50, 100];

  const [searchParams, setSearchParams] = useSearchParams();
  const globalFilter = getGlobalFilterParam(searchParams, props.queryKeyPrefix);
  const setGlobalFilter = (value: string | undefined) => {
    setSearchParams(
      setGlobalFilterParam(value === '' ? undefined : value, searchParams, props.queryKeyPrefix)
    );
  };
  const sortParams = getSortParams(searchParams, props.queryKeyPrefix);

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const table = useReactTable({
    data,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    state: {
      sorting: sortParams,
      rowSelection,
      globalFilter,
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) =>
      setSearchParams(
        setSortParams(
          typeof updater === 'function' ? updater(sortParams) : updater,
          searchParams,
          props.queryKeyPrefix
        )
      ),
    globalFilterFn: fuzzyFilter,
    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableMultiRowSelection: false,
    debugTable: false,
    autoResetPageIndex: false,
    initialState: {
      pagination: {
        pageSize: pageSizes[0],
      },
    },
  });

  return (
    <Box>
      <InputGroup
        css={{
          '&:hover .clear-filter': {
            color: 'var(--chakra-colors-gray-800)',
            transition: '0.3s',
          },
        }}
        maxW="30em"
        my={4}
      >
        <InputLeftElement pointerEvents="none" color="gray.300">
          <Icon fontSize="1.2em" as={BiSearch} />
        </InputLeftElement>
        <DebouncedInput
          debounce={300}
          borderRadius="100em"
          paddingStart={10}
          paddingEnd={10}
          placeholder="Search"
          value={globalFilter ?? ''}
          onChange={(v) => setGlobalFilter(v)}
        />
        {globalFilter ? (
          <InputRightElement>
            <IconButton
              onClick={() => setGlobalFilter(undefined)}
              className="clear-filter"
              fontSize="xl"
              color="gray.300"
              variant="ghost"
              size="sm"
              borderRadius={'100em'}
              icon={<Icon as={BsX} />}
              aria-label="clear search"
            />
          </InputRightElement>
        ) : null}
      </InputGroup>
      <Table>
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
                    <Td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Td>
                  );
                })}
              </Tr>
            );
          })}
        </Tbody>
      </Table>
      {table.getPrePaginationRowModel().rows.length > Math.min(...pageSizes) ? (
        <HStack justify="center" p={4}>
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
      ) : null}
    </Box>
  );
}

export const getSortParams = (
  searchParams: URLSearchParams,
  prefix?: string | undefined
): SortingState => {
  const sortColName = `${prefix ? prefix + '_' : ''}sortCol`;
  const sortDescName = `${prefix ? prefix + '_' : ''}sortDesc`;

  const cols = searchParams.getAll(sortColName);
  const isDescs = searchParams.getAll(sortDescName).map((isDesc) => isDesc === 'true');
  if (cols.length === isDescs.length) {
    return cols.map((col, i) => ({
      desc: isDescs[i],
      id: col,
    }));
  } else {
    console.warn('Failed to parse table-sorting state from URL.');
    return [];
  }
};
export const getGlobalFilterParam = (
  searchParams: URLSearchParams,
  prefix?: string | undefined
): string | undefined => {
  const paramName = `${prefix ? prefix + '_' : ''}search`;

  return searchParams.get(paramName) ?? undefined;
};

export const setGlobalFilterParam = (
  state: string | undefined,
  searchParams: URLSearchParams,
  prefix?: string | undefined
) => {
  const paramName = `${prefix ? prefix + '_' : ''}search`;
  searchParams.delete(paramName);
  state && searchParams.set(paramName, state);
  return searchParams;
};
export const getColumnFilterParam = (
  searchParams: URLSearchParams,
  prefix?: string | undefined
): ColumnFiltersState => {
  const paramName = `${prefix ? prefix + '_' : ''}colfilter`;
  const paramValue = searchParams.get(paramName);
  try {
    return paramValue
      ? JSON.parse(atob(decodeURIComponent(paramValue))).map((item: { i: string; v: any }) => ({
          id: item.i,
          value: item.v,
        }))
      : [];
  } catch (parsingError) {
    return [];
  }
};

export const setColumnFilterParam = (
  state: ColumnFiltersState,
  searchParams: URLSearchParams,
  prefix?: string | undefined
) => {
  const paramName = `${prefix ? prefix + '_' : ''}colfilter`;
  searchParams.delete(paramName);
  state.length &&
    searchParams.set(
      paramName,
      btoa(JSON.stringify(state.map((item) => ({ i: item.id, v: item.value }))))
    );
  return searchParams;
};

export const setSortParams = (
  state: SortingState,
  searchParams: URLSearchParams,
  prefix?: string | undefined
) => {
  const sortColName = `${prefix ? prefix + '_' : ''}sortCol`;
  const sortDescName = `${prefix ? prefix + '_' : ''}sortDesc`;
  searchParams.delete(sortColName);
  searchParams.delete(sortDescName);

  state.forEach((sort) => {
    searchParams.append(sortColName, String(sort.id));
    searchParams.append(sortDescName, String(sort.desc));
  });
  return searchParams;
};

export const DebouncedInput = forwardRef<
  InputProps & {
    /** (ms) */
    debounce?: number;
    onChange: (value: any) => void;
  },
  'input'
>(({ value: initialValue, onChange, debounce = 500, ...otherProps }, ref) => {
  const [value, setValue] = React.useState(initialValue);

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <Input ref={ref} {...otherProps} value={value} onChange={(e) => setValue(e.target.value)} />
  );
});
