import { Cell, flexRender } from "@tanstack/react-table";
import React, { useCallback, useMemo } from "react";
import { useGlobalContextMenuStore } from "../../../../store/globalContextMenuStore";
import { useSmartDrillStore } from "../../../../store/smartDrillStore";
import { ComparisonResult } from "../../../../utils/comparisonUtils";
import { formatCell } from "../../../../utils/formatUtils";
import { CellContextMenu } from "./CellContextMenu";
import styles from "./DataCell.module.css";

const DataCell = ({
  cell,
  comparisonResult,
  rowIndex,
}: {
  cell: Cell<unknown[], unknown>;
  comparisonResult?: ComparisonResult | null;
  rowIndex?: number;
}): React.JSX.Element => {
  const { column } = cell;

  const setContextMenu = useGlobalContextMenuStore(
    (state) => state.setContextMenu
  );
  const isCellContextMenuOpen = useGlobalContextMenuStore(
    (state) => state.isCellContextMenuOpen(cell.id)
  );

  // Only subscribe to whether this specific cell is selected/anchor
  const cellRowId = cell.row.id;
  const cellColumnId = column.id;

  const isSelected = useSmartDrillStore((state) =>
    state.selectedCells.has(cell.id)
  );

  const isAnchor = useSmartDrillStore(
    (state) =>
      state.anchorCell?.row.id === cellRowId &&
      state.anchorCell.column.id === cellColumnId
  );

  const selectCell = useSmartDrillStore((state) => state.selectCell);
  const toggleCellSelection = useSmartDrillStore(
    (state) => state.toggleCellSelection
  );
  const selectRectangle = useSmartDrillStore((state) => state.selectRectangle);

  // Check if this cell should be highlighted as different
  const columnIndex = cell.column.getIndex(); // Get the column index for comparison
  const isDifferent =
    comparisonResult && rowIndex !== undefined
      ? comparisonResult.differences.has(`${rowIndex},${columnIndex}`)
      : false;

  const handleCellClick = useCallback(
    (event: React.MouseEvent) => {
      const anchorCell = useSmartDrillStore.getState().anchorCell;
      if (event.shiftKey && anchorCell) {
        selectRectangle(anchorCell, cell);
      } else if (event.ctrlKey || event.metaKey) {
        toggleCellSelection(cell);
      } else {
        selectCell(cell);
      }
    },
    [selectRectangle, cell, toggleCellSelection, selectCell]
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
    [selectCell, cell, setContextMenu]
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
        cell.getContext()
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
        } ${isPinned ? styles.pinned : ""} ${
          isGrouped ? styles.groupedCell : ""
        }`}
        title={cell.getValue()?.toString() ?? ""}
        style={{
          width: `calc(var(--col-${column.id}-size) * 1px)`,
          ...offset,
        }}
        onClick={handleCellClick}
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
              {row.getIsExpanded() ? "▼" : "▶"}
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

export default DataCell;
