import { Table } from "@tanstack/react-table";
import { useCallback, useEffect, useRef } from "react";
import { TableVirtuosoHandle } from "react-virtuoso";
import { copySelectedCells } from "../services/ClipboardService";
import { useSmartDrillStore } from "../store/smartDrillStore";

interface UseTableBehaviorReturn {
  // Scroll-related
  scrollParentRef: React.RefObject<HTMLDivElement | null>;
  virtuosoRef: React.RefObject<TableVirtuosoHandle | null>;
}

export const useTableBehavior = (
  table: Table<unknown[]>
): UseTableBehaviorReturn => {
  // Scroll-related state
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const virtuosoRef = useRef<TableVirtuosoHandle>(null);

  /**
   * Returns the currently active cell for scrolling purposes.
   * If multiple cells are selected, it returns the lower-right corner cell.
   * If no cells are selected, it returns the anchor cell if available.
   */
  const getActiveCell = useCallback((): {
    rowIndex: number;
    columnId: string;
  } | null => {
    // Get fresh data when needed instead of subscribing to everything
    const { selectedCells, anchorCell: currentAnchorCell } =
      useSmartDrillStore.getState();

    if (selectedCells.size === 0 || !currentAnchorCell) {
      return currentAnchorCell
        ? {
            rowIndex: parseInt(currentAnchorCell.row.id),
            columnId: currentAnchorCell.column.id,
          }
        : null;
    }

    if (selectedCells.size === 1) {
      const cell = Array.from(selectedCells.values())[0];
      return {
        rowIndex: parseInt(cell.row.id),
        columnId: cell.column.id,
      };
    }

    // For multiple cells, find the lower-right corner
    const cellsArray = Array.from(selectedCells.values());
    const rowIndices = cellsArray.map((cell) => parseInt(cell.row.id));
    const maxRowIndex = Math.max(...rowIndices);

    // Get column order from table headers
    const columnOrder = table.getLeafHeaders().map((header) => header.id);
    const colIndices = cellsArray.map((cell) =>
      columnOrder.indexOf(cell.column.id)
    );
    const maxColIndex = Math.max(...colIndices);

    return {
      rowIndex: maxRowIndex,
      columnId: columnOrder[maxColIndex],
    };
  }, [table]);

  // Function to scroll the focused cell into view
  const scrollToCell = useCallback(
    (rowIndex: number, columnId?: string) => {
      // Handle vertical scrolling
      if (virtuosoRef.current) {
        virtuosoRef.current.scrollIntoView({
          index: rowIndex,
        });
      }

      // Handle horizontal scrolling
      if (columnId && scrollParentRef.current) {
        const column = table
          .getLeafHeaders()
          .find((col) => col.id === columnId);

        // Check if column is visible in viewport
        const columnLeft = column?.getStart() ?? 0;
        const columnRight = columnLeft + (column?.getSize() ?? 0);
        const viewportLeft = scrollParentRef.current.scrollLeft ?? 0;
        const viewportRight =
          viewportLeft + scrollParentRef.current.clientWidth;

        let newScrollLeft = scrollParentRef.current.scrollLeft;

        // If column is to the left of viewport, scroll left
        if (columnLeft < viewportLeft) {
          newScrollLeft = columnLeft;
        }
        // If column is to the right of viewport, scroll right
        else if (columnRight > viewportRight) {
          newScrollLeft = columnRight - scrollParentRef.current.clientWidth;
        }

        if (newScrollLeft !== scrollParentRef.current.scrollLeft) {
          scrollParentRef.current.scrollTo({
            left: Math.max(0, newScrollLeft),
            behavior: "smooth",
          });
        }
      }
    },
    [scrollParentRef, table]
  );

  // Keyboard navigation handling
  // Get navigation functionality from the store
  const navigateCell = useSmartDrillStore((state) => state.navigateCell);
  const selectRectangleWithDirection = useSmartDrillStore(
    (state) => state.selectRectangleWithDirection
  );

  // Handle keyboard shortcuts and navigation
  const handleKeyDown = useCallback(
    async (event: KeyboardEvent): Promise<void> => {
      if ((event.ctrlKey || event.metaKey) && event.key === "c") {
        // Only intercept Ctrl+C if there are selected cells in smart drill store
        // Otherwise, allow default browser copy behavior (for footer cells, text selection, etc.)
        const selectedCells = useSmartDrillStore.getState().selectedCells;
        if (selectedCells.size > 0) {
          event.preventDefault();
          // needs `stopPropagation` here, maybe ctrl+c is handled differently in vscode
          event.stopPropagation();
          await copySelectedCells();
          return;
        }
        // If no selected cells, allow default copy behavior to work
        return;
      }

      // Handle arrow key navigation
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        event.preventDefault();

        let direction: "up" | "down" | "left" | "right";
        switch (event.key) {
          case "ArrowUp":
            direction = "up";
            break;
          case "ArrowDown":
            direction = "down";
            break;
          case "ArrowLeft":
            direction = "left";
            break;
          case "ArrowRight":
            direction = "right";
            break;
          default:
            return;
        }

        // If shift is held, select rectangle, otherwise navigate normally
        if (event.shiftKey) {
          selectRectangleWithDirection(direction, table);
        } else {
          navigateCell(direction, table);
        }
        const activeCell = getActiveCell();
        if (activeCell) {
          scrollToCell(activeCell.rowIndex, activeCell.columnId);
        }
      }
    },
    [
      getActiveCell,
      navigateCell,
      scrollToCell,
      selectRectangleWithDirection,
      table,
    ]
  );

  useEffect(() => {
    const ref = scrollParentRef.current;
    if (ref) {
      ref.addEventListener("keydown", handleKeyDown);
    }

    return (): void => {
      if (ref) {
        ref.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [handleKeyDown]);

  return {
    // Scroll-related
    scrollParentRef,
    virtuosoRef,
  };
};
