import { Cell, flexRender } from "@tanstack/react-table";
import React, { JSX, useCallback, useMemo } from "react";
import { useGlobalContextMenuStore } from "../../../../store/globalContextMenuStore";
import { useSmartDrillStore } from "../../../../store/smartDrillStore";
import { useTabStore } from "../../../../store/tabStore";
import { ComparisonResult } from "../../../../utils/comparisonUtils";
import { formatCell } from "../../../../utils/formatUtils";
import { CellContextMenu } from "./CellContextMenu";
import styles from "./DataCell.module.css";

const DataCellFunc = ({
  cell,
  comparisonResult,
  comparisonSide,
}: {
  cell: Cell<unknown[], unknown>;
  comparisonResult?: ComparisonResult | null;
  comparisonSide: "base" | "comparison";
}): JSX.Element => {
  const { column } = cell;
  const isExpanded = useTabStore((state) => {
    const activeTabId = state.activeTabId;
    const expandedState = activeTabId
      ? state.getTab(activeTabId)?.expandedState
      : undefined;
    return (
      expandedState === true ||
      (typeof expandedState === "object" &&
        expandedState[cell.row.id] === true)
    );
  });

  const setContextMenu = useGlobalContextMenuStore(
    (state) => state.setContextMenu,
  );
  const isCellContextMenuOpen = useGlobalContextMenuStore((state) =>
    state.isCellContextMenuOpen(cell.id),
  );

  // Only subscribe to whether this specific cell is selected/anchor
  const cellRowId = cell.row.id;
  const cellColumnId = column.id;

  const isSelected = useSmartDrillStore((state) =>
    state.selectedCells.has(cell.id),
  );

  const isAnchor = useSmartDrillStore(
    (state) =>
      state.anchorCell?.row.id === cellRowId &&
      state.anchorCell.column.id === cellColumnId,
  );

  const selectCell = useSmartDrillStore((state) => state.selectCell);
  const toggleCellSelection = useSmartDrillStore(
    (state) => state.toggleCellSelection,
  );
  const selectRectangle = useSmartDrillStore((state) => state.selectRectangle);

  const dataColumnIndex = cell.column.columnDef.meta?.["dataIndex"];
  const originalRowIndex = cell.row.index;
  const isDifferent =
    comparisonResult && typeof dataColumnIndex === "number"
      ? (comparisonSide === "base"
          ? comparisonResult.baseDifferences
          : comparisonResult.differences
        ).has(`${originalRowIndex},${dataColumnIndex}`)
      : false;
  const differenceKey =
    typeof dataColumnIndex === "number"
      ? `${originalRowIndex},${dataColumnIndex}`
      : "";
  const differenceDetail =
    comparisonSide === "base"
      ? comparisonResult?.baseDifferenceDetails.get(differenceKey)
      : comparisonResult?.comparisonDifferenceDetails.get(differenceKey);
  const isAmbiguousKey =
    comparisonSide === "base"
      ? (comparisonResult?.ambiguousBaseRows.has(originalRowIndex) ?? false)
      : (comparisonResult?.ambiguousComparisonRows.has(originalRowIndex) ??
        false);
  const isDuplicateKey =
    comparisonSide === "base"
      ? (comparisonResult?.duplicateBaseRows.has(originalRowIndex) ?? false)
      : (comparisonResult?.duplicateComparisonRows.has(originalRowIndex) ??
        false);
  const isUnmatched =
    comparisonSide === "base"
      ? (comparisonResult?.unmatchedBaseRowIndexes.has(originalRowIndex) ??
        false)
      : (comparisonResult?.unmatchedComparisonRows.has(originalRowIndex) ??
        false);
  const isUnmatchableKey =
    comparisonSide === "base"
      ? (comparisonResult?.unmatchableBaseRows.has(originalRowIndex) ?? false)
      : (comparisonResult?.unmatchableComparisonRows.has(originalRowIndex) ??
        false);
  const rowKey =
    comparisonSide === "base"
      ? comparisonResult?.baseRowKeys.get(originalRowIndex)
      : comparisonResult?.comparisonRowKeys.get(originalRowIndex);
  const comparisonTitle = isUnmatchableKey
    ? `This row has a NULL or missing comparison key (${rowKey ?? "key unavailable"}); it cannot be classified as added or removed`
    : isAmbiguousKey
      ? isDuplicateKey
        ? `This row has a duplicate key (${rowKey ?? "key unavailable"}); its matching row is ambiguous`
        : `This row's key is duplicated in the other result (${rowKey ?? "key unavailable"}); its matching row is ambiguous`
      : isUnmatched
        ? `${comparisonSide === "base" ? "Removed" : "Added"} row (${rowKey ?? "key unavailable"}); no row with this key exists in the ${
            comparisonSide === "base" ? "comparison" : "base"
          } result`
        : differenceDetail
          ? `Compared values for ${differenceDetail.columnName}:\nBase: ${
              differenceDetail.baseValue === null ||
              differenceDetail.baseValue === undefined
                ? "NULL"
                : String(differenceDetail.baseValue)
            }\nComparison: ${
              differenceDetail.comparisonValue === null ||
              differenceDetail.comparisonValue === undefined
                ? "NULL"
                : String(differenceDetail.comparisonValue)
            }`
          : (cell.getValue()?.toString() ?? "");

  const handleCellPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (
        event.button !== 0 ||
        (event.target instanceof Element && event.target.closest("button"))
      ) {
        return;
      }

      const anchorCell = useSmartDrillStore.getState().anchorCell;
      if (event.shiftKey && anchorCell) {
        selectRectangle(anchorCell, cell);
      } else if (event.ctrlKey || event.metaKey) {
        toggleCellSelection(cell);
      } else {
        selectCell(cell);
      }
    },
    [selectRectangle, cell, toggleCellSelection, selectCell],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      // event.stopPropagation();

      // Check selection status lazily when actually needed
      const currentState = useSmartDrillStore.getState();
      const isCellSelected = currentState.selectedCells.has(cell.id);

      // If this cell is not selected, select it first
      if (!isCellSelected) {
        selectCell(cell);
      }

      setContextMenu({
        type: "cell",
        x: event.clientX,
        y: event.clientY,
        cellId: cell.id,
      });
    },
    [selectCell, cell, setContextMenu],
  );

  const isPinned = column.getIsPinned();
  const isGrouped = cell.getIsGrouped();
  const isColumnGrouped = column.getIsGrouped();
  const isRowGrouped = cell.row.getIsGrouped();
  const isPlaceholder = cell.getIsPlaceholder();
  const row = cell.row;

  const type = cell.column.columnDef.meta?.["type"];
  const value = cell.getValue();
  const formattedValue = useMemo(() => formatCell(value, type), [value, type]);

  const renderContent = (): React.ReactNode => {
    if (isPlaceholder || (isColumnGrouped && !isGrouped)) {
      return null;
    }
    if (isRowGrouped) {
      return flexRender(
        cell.column.columnDef.aggregatedCell,
        cell.getContext(),
      );
    }
    if (formattedValue === null && !isRowGrouped) {
      return <span className={styles.nullValue}>null</span>;
    }
    return formattedValue;
  };

  const offset: React.CSSProperties = isPinned
    ? {
        left: `${column.getStart("left")}px`,
        position: "sticky",
        zIndex: 1,
      }
    : {};

  return (
    <>
      <td
        className={`${styles.virtualCell} ${
          isSelected ? styles.selectedCell : ""
        } ${isAnchor ? styles.anchorCell : ""} ${
          isDifferent ? styles.differentCell : ""
        } ${isAmbiguousKey ? styles.ambiguousKeyCell : ""} ${
          isUnmatched && comparisonSide === "base"
            ? styles.removedCell
            : isUnmatched
              ? styles.addedCell
              : ""
        } ${isPinned ? styles.pinned : ""} ${
          isGrouped ? styles.groupedCell : ""
        }`}
        title={comparisonTitle}
        style={{
          width: `calc(var(--col-${column.id}-size) * 1px)`,
          ...offset,
        }}
        onPointerDown={handleCellPointerDown}
        onContextMenu={handleContextMenu}
      >
        {isGrouped ? (
          <div className={styles.groupContainer}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                row.toggleExpanded();
              }}
              className={styles.expandButton}
            >
              {isExpanded ? "▼" : "▶"}
            </button>
            {renderContent()}
            <span className={styles.groupCount}>({row.subRows.length})</span>
          </div>
        ) : (
          renderContent()
        )}
      </td>
      {isCellContextMenuOpen && (
        <CellContextMenu
          x={useGlobalContextMenuStore.getState().contextMenu?.x ?? 0}
          y={useGlobalContextMenuStore.getState().contextMenu?.y ?? 0}
        />
      )}
    </>
  );
};

const DataCell = React.memo(DataCellFunc, (prevProps, nextProps) => {
  return (
    prevProps.cell.id === nextProps.cell.id &&
    prevProps.cell.getValue() === nextProps.cell.getValue() &&
    prevProps.comparisonResult === nextProps.comparisonResult &&
    prevProps.comparisonSide === nextProps.comparisonSide
  );
});

export default DataCell;
