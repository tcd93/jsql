import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  ColumnResizeMode,
  getGroupedRowModel,
  getExpandedRowModel,
  Row,
  Cell,
} from "@tanstack/react-table";
import React, { useMemo, useEffect, useRef, useCallback } from "react";
import { TableVirtuoso } from "react-virtuoso";
import { useShallow } from "zustand/react/shallow";
import { useBatchedData } from "../../../../hooks/useBatchedData";
import { useColumnAggregation } from "../../../../hooks/useColumnAggregation";
import { useTableBehavior } from "../../../../hooks/useTableBehavior";
import { useFooterStore } from "../../../../store/footerStore";
import { useTabStore } from "../../../../store/tabStore";
import {
  mapColumns,
  compareTabData,
  ComparisonResult,
} from "../../../../utils/comparisonUtils";
import DataCell from "../Cell/DataCell";
import { RowNumberCell } from "../Cell/RowNumberCell";
import { FooterRow } from "./FooterRow";
import { HeaderRow } from "./HeaderRow";
import styles from "./ResultsTable.module.css";

interface ResultsTableProps {
  searchText: string;
  tabId: string;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ searchText, tabId }) => {
  const schema = useTabStore((state) => state.getTab(tabId)?.schema);
  const stats = useTabStore((state) => state.getTab(tabId)?.streamStats);
  const selectedBaseTabId = useTabStore((state) => state.selectedBaseTabId);
  const selectedComparisonTabId = useTabStore(
    (state) => state.selectedComparisonTabId
  );
  const getTab = useTabStore((state) => state.getTab);
  const groupedColumns =
    useTabStore(
      useShallow((state) =>
        state.getTab(tabId)?.groupedColumns.map((col) => col.id)
      )
    ) ?? [];
  const pinnedColumns = useTabStore(
    useShallow((state) => state.getTab(tabId)?.pinnedColumns)
  );
  const expandedState = useTabStore(
    useShallow((state) => state.getTab(tabId)?.expandedState)
  );
  const columnOrder = useTabStore((state) => state.getTab(tabId)?.columnOrder);

  const validAffectedRows = useMemo(() => {
    return stats?.affectedRows?.filter((row) => row > 0) ?? [];
  }, [stats?.affectedRows]);

  const batchData = useBatchedData(tabId, {
    batchSize: 50,
    batchInterval: 50,
    renderThreshold: 10,
  });

  // Monitor column selections for aggregation metrics
  useColumnAggregation(tabId);

  // Calculate comparison data when in comparison mode
  const comparisonResult = useMemo((): ComparisonResult | null => {
    if (
      !selectedBaseTabId ||
      !selectedComparisonTabId ||
      tabId !== selectedComparisonTabId
    ) {
      return null;
    }

    const baseTab = getTab(selectedBaseTabId);
    const currentTab = getTab(tabId);

    if (!baseTab || !currentTab || !baseTab.schema || !currentTab.schema) {
      return null;
    }

    const columnMappings = mapColumns(baseTab.schema, currentTab.schema);
    return compareTabData(baseTab.data, currentTab.data, columnMappings);
  }, [selectedBaseTabId, selectedComparisonTabId, tabId, getTab]);

  const columns = useMemo<ColumnDef<unknown[]>[]>(() => {
    if (!schema || schema.length === 0) {
      return [];
    }

    const rowNumberColumn: ColumnDef<unknown[]> = {
      id: "__row_number__",
      accessorFn: (_row: unknown[], index: number): number => index + 1,
      header: "#",
      enableSorting: false,
      enableGrouping: false,
      enableColumnFilter: false,
      enableGlobalFilter: false,
      enableResizing: true,
      size: 60,
      minSize: 45,
    };

    const dataColumns = schema.map((field, index) => {
      // Ensure uniqueness
      const columnId = `${field.name}_${index}`;

      return {
        id: columnId,
        accessorFn: (row: unknown[]): unknown => row[index],
        aggregationFn: field.aggregationFn ?? "auto",
        header: field.name,
        meta: { type: field.type },
        size: 150,
        minSize: 60,
        maxSize: 800,
      } as ColumnDef<unknown[]>;
    });

    return [rowNumberColumn, ...dataColumns];
  }, [schema]);

  const prevSchemaRef = useRef(schema);

  // Tanstack Table v8 doesn't automatically invalidate aggregation cache when column definitions change
  // (specifically aggregationFn). We force a data refresh to trigger recalculation when schema changes.
  // We use a ref to only clone data when schema changes, avoiding O(N) copy on every data update.
  const tableData = useMemo(() => {
    if (prevSchemaRef.current !== schema) {
      prevSchemaRef.current = schema;
      return [...batchData];
    }
    return batchData;
  }, [batchData, schema]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      globalFilter: searchText,
      columnOrder: columnOrder ?? [],
      expanded: expandedState ?? {},
      grouping: groupedColumns,
    },
    onColumnOrderChange: (updaterOrValue) => {
      const newOrder =
        typeof updaterOrValue === "function"
          ? updaterOrValue(columnOrder ?? [])
          : updaterOrValue;
      useTabStore.getState().updateTab(tabId, { columnOrder: newOrder });
    },
    onExpandedChange: (updaterOrValue) => {
      const expandedState =
        typeof updaterOrValue === "function"
          ? updaterOrValue(table.getState().expanded)
          : updaterOrValue;
      useTabStore.getState().updateTab(tabId, {
        expandedState,
      });
    },
    enableColumnResizing: true,
    enableColumnPinning: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange" as ColumnResizeMode,
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    autoResetExpanded: false,
  });

  useEffect(() => {
    const pinnedColumnIds = pinnedColumns?.map((header) => {
      const column = table
        .getAllColumns()
        .find((col) => col.columnDef.header === header);
      return column ? column.id : "";
    });
    table?.setColumnPinning({
      left: pinnedColumnIds,
    });
  }, [tabId, table, pinnedColumns]);

  // Get table behavior (scrolling) from custom hook
  const { scrollParentRef, virtuosoRef } = useTableBehavior(table);

  const filteredRows = table.getRowModel().rows;
  const showFooter = useFooterStore(
    (state) => state.showFooter && schema && schema.length > 0
  );

  const columnSizeVars = table.getFlatHeaders().reduce((colSizes, header) => {
    colSizes[`--header-${header.id}-size`] = header.getSize();
    colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    return colSizes;
  }, {} as Record<string, number>);

  const virtuosoComponents = useMemo(
    () => ({
      TableRow: (
        props: {
          item: Row<unknown[]>;
        } & React.HTMLAttributes<HTMLTableRowElement>
      ): React.JSX.Element => {
        const isGrouped = props.item.getIsGrouped();
        return <tr {...props} className={isGrouped ? styles.groupedRow : ""} />;
      },
    }),
    []
  );

  const fixedHeaderContent = useCallback(
    () => <HeaderRow table={table} />,
    [
      table,  
      // eslint-disable-next-line react-hooks/exhaustive-deps
      table.getState().columnOrder,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      table.getState().grouping,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      table.getState().sorting,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      table.getState().columnPinning,
    ]
  );

  const fixedFooterContent = useCallback(
    () =>
      showFooter ? (
        <FooterRow table={table} />
      ) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      showFooter,
      table,
      schema,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      table.getRowModel(),
    ]
  );

  const itemContent = useCallback(
    (rowIndex: number, row: Row<unknown[]>) => {
      return (
        <>
          {row.getVisibleCells().map((cell: Cell<unknown[], unknown>) => {
            /**Don't map DataCell for row number column */
            if (cell.column.id === "__row_number__") {
              return (
                <RowNumberCell key={cell.id} cell={cell} rowIndex={rowIndex} />
              );
            }
            return (
              <DataCell
                key={cell.id}
                cell={cell}
                comparisonResult={comparisonResult}
                rowIndex={rowIndex}
              />
            );
          })}
        </>
      );
    },
    [comparisonResult]
  );

  return (
    <div
      ref={scrollParentRef}
      className={`${styles.resultsTable}`}
      style={{
        ...columnSizeVars,
      }}
      tabIndex={0}
      role="grid"
      aria-label="Data table with copyable cells"
    >
      {scrollParentRef.current && (
        <>
          <TableVirtuoso
            ref={virtuosoRef}
            data={filteredRows}
            overscan={300}
            components={virtuosoComponents}
            fixedHeaderContent={fixedHeaderContent}
            fixedFooterContent={fixedFooterContent}
            customScrollParent={scrollParentRef.current}
            itemContent={itemContent}
          />
        </>
      )}
      {(!schema || schema.length === 0) && stats?.complete && (
        <div className={styles.emptyState}>
          <p>
            Query completed with {stats.rows} rows ({stats.batches} batch
            {stats.batches !== 1 ? "es" : ""})
          </p>
          {validAffectedRows.length > 0 && (
            <p>Affected {validAffectedRows.join(", ")} rows</p>
          )}
        </div>
      )}
      {(!schema || schema.length === 0) && !stats?.complete && (
        <div className={styles.emptyState}>No data to display</div>
      )}
    </div>
  );
};

export default ResultsTable;
