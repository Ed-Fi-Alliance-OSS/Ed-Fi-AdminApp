import { ChakraComponent, useBoolean } from '@chakra-ui/react';
import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  Table as TrtTable,
  OnChangeFn,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  ExpandedState,
  getExpandedRowModel,
} from '@tanstack/react-table';
import React, { createContext, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fuzzyFilter,
  getColumnFilterParam,
  getGlobalFilterParam,
  getSortParams,
  setColumnFilterParam,
  setGlobalFilterParam,
  setSortParams,
} from '../dataTable';

export const SbaaTableContext = createContext<{
  table: TrtTable<any> | null;
  pageSizes: number[];
  pendingFilterColumn: string | boolean;
  setPendingFilterColumn: (colId: string | boolean) => void;
  isRowSelectionEnabled?: boolean;
  showSettings: readonly [
    boolean,
    {
      on: () => void;
      off: () => void;
      toggle: () => void;
    }
  ];
}>({
  table: null,
  pageSizes: [10, 25, 50, 100],
  pendingFilterColumn: false,
  isRowSelectionEnabled: false,
  setPendingFilterColumn: () => false,
  showSettings: [false, { on: () => undefined, off: () => undefined, toggle: () => undefined }],
});

export const useSbaaTableContext = () => React.useContext(SbaaTableContext);
export type DivComponent = ChakraComponent<'div'>;

export function SbaaTableProvider<
  UseSubRows extends boolean,
  T extends UseSubRows extends true ? { id: any; subRows: T[] } : { id: any }
>(props: {
  useSubRows?: UseSubRows;
  children?: React.ReactNode;
  data: T[] | IterableIterator<T>;
  columns: ColumnDef<T>[];
  enableRowSelection?: boolean;
  rowSelectionState?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState> | undefined;
  pageSizes?: number[];
  queryKeyPrefix?: string | undefined;
}) {
  const data = useMemo(() => [...props.data], [props.data]);
  const columns = props.columns;
  const pageSizes = props.pageSizes ?? [10, 25, 50, 100];
  const [searchParams, setSearchParams] = useSearchParams();

  const columnFilters = getColumnFilterParam(searchParams, props.queryKeyPrefix);
  const setColumnFilters = (
    updater: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)
  ) => {
    if (typeof updater === 'function') {
      setSearchParams(
        setColumnFilterParam(updater(columnFilters), searchParams, props.queryKeyPrefix)
      );
    } else {
      setSearchParams(setColumnFilterParam(updater, searchParams, props.queryKeyPrefix));
    }
  };
  const [pendingFilterColumn, setPendingFilterColumn] = React.useState<string | boolean>(false);

  const globalFilter = getGlobalFilterParam(searchParams, props.queryKeyPrefix);
  const setGlobalFilter = (value: string | undefined) => {
    setSearchParams(
      setGlobalFilterParam(value === '' ? undefined : value, searchParams, props.queryKeyPrefix)
    );
  };
  const sortParams = getSortParams(searchParams, props.queryKeyPrefix);

  const showSettings = useBoolean(sortParams.length > 1 || columnFilters.length > 0);

  const [expanded, setExpanded] = React.useState<ExpandedState>({});

  const table = useReactTable({
    data,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    state: {
      sorting: sortParams,
      globalFilter,
      columnFilters,
      ...(props.rowSelectionState ? { rowSelection: props.rowSelectionState } : {}),
      expanded,
    },
    getSubRows: props.useSubRows ? (row) => row.subRows : undefined,
    filterFromLeafRows: true,
    onExpandedChange: setExpanded,
    onSortingChange: (updater) =>
      setSearchParams(
        setSortParams(
          typeof updater === 'function' ? updater(sortParams) : updater,
          searchParams,
          props.queryKeyPrefix
        )
      ),
    globalFilterFn: fuzzyFilter,
    ...(props.onRowSelectionChange ? { onRowSelectionChange: props.onRowSelectionChange } : {}),
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getExpandedRowModel: props.useSubRows ? getExpandedRowModel() : undefined,
    enableMultiRowSelection: props.enableRowSelection,
    getRowId: (row) => row.id,
    enableMultiSort: true,
    debugTable: false,
    autoResetPageIndex: false,
    initialState: {
      pagination: {
        pageSize: pageSizes[0],
      },
    },
  });

  useEffect(() => {
    if (table.getState().pagination.pageIndex > table.getPageCount() - 1) {
      table.setPageIndex(table.getPageCount() - 1);
    }
  });

  return (
    <SbaaTableContext.Provider
      value={{
        table,
        pageSizes,
        pendingFilterColumn,
        setPendingFilterColumn,
        isRowSelectionEnabled: props.enableRowSelection,
        showSettings,
      }}
    >
      {props.children}
    </SbaaTableContext.Provider>
  );
}
