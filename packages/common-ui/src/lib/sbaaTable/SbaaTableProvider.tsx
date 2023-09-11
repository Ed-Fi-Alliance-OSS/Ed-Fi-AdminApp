import { ChakraComponent, useBoolean } from '@chakra-ui/react';
import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  Table as TrtTable,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import React, { createContext, useMemo } from 'react';
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
  setPendingFilterColumn: () => false,
  showSettings: [false, { on: () => undefined, off: () => undefined, toggle: () => undefined }],
});

export const useSbaaTableContext = () => React.useContext(SbaaTableContext);
export type DivComponent = ChakraComponent<'div'>;

export function SbaaTableProvider<T extends object>(props: {
  children?: React.ReactNode;
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
    },
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
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    enableMultiRowSelection: false,
    enableMultiSort: true,
    debugTable: false,
    autoResetPageIndex: false,
    initialState: {
      pagination: {
        pageSize: pageSizes[0],
      },
    },
  });

  return (
    <SbaaTableContext.Provider
      value={{
        table,
        pageSizes,
        pendingFilterColumn,
        setPendingFilterColumn,
        showSettings,
      }}
    >
      {props.children}
    </SbaaTableContext.Provider>
  );
}
