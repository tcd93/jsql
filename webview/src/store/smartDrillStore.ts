import { SmartDrillCellSelection, SmartDrillTableRequest } from "@src/types";
import { Cell, Header, Table } from "@tanstack/react-table";
import { create } from "zustand";

interface SmartDrillState {
  selectedCells: Map<string, Cell<unknown[], unknown>>;
  anchorCell: Cell<unknown[], unknown> | null;
  isLoading: boolean;
  matchedTables: SmartDrillTableRequest[];
  isSmartDrillOpen: boolean;

  /**
   * Select a single cell, clear other selections
   */
  selectCell: (cell: Cell<unknown[], unknown>) => void;

  /**
   * Add or remove a cell from current selection
   */
  toggleCellSelection: (cell: Cell<unknown[], unknown>) => void;

  /**
   * Select a rectangle of cells
   */
  selectRectangle: (
    anchorCell: Cell<unknown[], unknown>,
    targetCell: Cell<unknown[], unknown>
  ) => void;

  /**
   * Select an entire column
   */
  selectColumn: (header: Header<unknown[], unknown>) => void;

  clearSelection: () => void;
  setMatchedTables: (tables: SmartDrillTableRequest[]) => void;
  setLoading: (loading: boolean) => void;
  setSmartDrillOpen: (open: boolean) => void;
  getUniqueColumnNames: () => string[];

  // Convert cells to plain objects for backend communication
  getSelectedCellsAsPlain: () => SmartDrillCellSelection[];

  // Keyboard navigation
  navigateCell: (
    direction: "up" | "down" | "left" | "right",
    table: Table<unknown[]>
  ) => Cell<unknown[], unknown> | null;

  // Rectangle selection with direction
  selectRectangleWithDirection: (
    direction: "up" | "down" | "left" | "right",
    table: Table<unknown[]>
  ) => void;
}

export const useSmartDrillStore = create<SmartDrillState>((set, get) => ({
  selectedCells: new Map(),
  anchorCell: null,
  isLoading: false,
  matchedTables: [],
  isSmartDrillOpen: false,
  activeTabId: null,

  selectCell: (cell: Cell<unknown[], unknown>): void => {
    const cellId = cell.id;
    const currentCells = get().selectedCells;

    // If the current selection is also single and the same as the new selection, clear the selection
    if (currentCells.size === 1 && currentCells.has(cellId)) {
      set({
        selectedCells: new Map(),
        anchorCell: null,
      });
      return;
    }

    const newMap = new Map();
    newMap.set(cellId, cell);
    set({
      selectedCells: newMap,
      anchorCell: cell,
      matchedTables: [],
      isSmartDrillOpen: false,
    });
  },

  toggleCellSelection: (cell: Cell<unknown[], unknown>): void => {
    const state = get();
    const cellId = cell.id;
    const newSelectedCells = new Map(state.selectedCells);

    if (newSelectedCells.has(cellId)) {
      newSelectedCells.delete(cellId);

      // If we're removing the anchor cell, clear the anchor
      const isRemovingAnchor =
        state.anchorCell?.id === cellId;

      // If no cells left or removing anchor, clear anchor
      const newAnchorCell =
        newSelectedCells.size === 0 || isRemovingAnchor
          ? null
          : state.anchorCell;

      set({
        selectedCells: newSelectedCells,
        anchorCell: newAnchorCell,
        matchedTables: [],
        isSmartDrillOpen: false,
      });
    } else {
      newSelectedCells.set(cellId, cell);
      set({
        selectedCells: newSelectedCells,
        matchedTables: [],
        isSmartDrillOpen: false,
      });
    }
  },

  selectRectangle: (
    anchorCell: Cell<unknown[], unknown>,
    targetCell: Cell<unknown[], unknown>
  ): void => {
    const table = anchorCell.getContext().table;
    const startRowId = anchorCell.row.id;
    const startColumnId = anchorCell.column.id;
    const endRowId = targetCell.row.id;
    const endColumnId = targetCell.column.id;

    const rows = table.getRowModel().rows;
    const startRowIndex = rows.findIndex((r) => r.id === startRowId);
    const endRowIndex = rows.findIndex((r) => r.id === endRowId);

    const minRowIndex = Math.min(startRowIndex, endRowIndex);
    const maxRowIndex = Math.max(startRowIndex, endRowIndex);

    const leafColumns = table.getVisibleLeafColumns();
    const startColIndex = leafColumns.findIndex(
      (col) => col.id === startColumnId
    );
    const endColIndex = leafColumns.findIndex((col) => col.id === endColumnId);
    const minColIndex = Math.min(startColIndex, endColIndex);
    const maxColIndex = Math.max(startColIndex, endColIndex);

    const rectangleSelections = new Map<string, Cell<unknown[], unknown>>();
    for (let r = minRowIndex; r <= maxRowIndex; r++) {
      const row = rows[r];
      if (row) {
        for (let c = minColIndex; c <= maxColIndex; c++) {
          const columnId = leafColumns[c].id ?? "";
          const cell = row
            .getAllCells()
            .find((cell) => cell.column.id === columnId);
          if (cell) {
            rectangleSelections.set(cell.id, cell);
          }
        }
      }
    }

    set({
      selectedCells: rectangleSelections,
      anchorCell,
      matchedTables: [],
      isSmartDrillOpen: false,
    });
  },

  selectColumn: (header: Header<unknown[], unknown>): void => {
    const table = header.getContext().table;
    const rows = table.getRowModel().rows;
    let firstCell: Cell<unknown[], unknown> | null = null;

    // Build array of entries first, then create Map in one operation
    // This is faster than many individual .set() calls for large datasets
    const entries: [string, Cell<unknown[], unknown>][] = [];
    
    for (const row of rows) {
      const cell = row
        .getAllCells()
        .find((cell) => cell.column.id === header.column.id);
      if (cell) {
        entries.push([cell.id, cell]);
        firstCell ??= cell;
      }
    }

    const columnSelections = new Map(entries);

    set({
      selectedCells: columnSelections,
      anchorCell: firstCell,
      matchedTables: [],
      isSmartDrillOpen: false,
    });
  },

  clearSelection: (): void => {
    set({
      selectedCells: new Map(),
      anchorCell: null,
      matchedTables: [],
      isSmartDrillOpen: false,
    });
  },

  setMatchedTables: (tables: SmartDrillTableRequest[]): void =>
    set({ matchedTables: tables }),
  setLoading: (loading: boolean): void => set({ isLoading: loading }),
  setSmartDrillOpen: (open: boolean): void => set({ isSmartDrillOpen: open }),

  getUniqueColumnNames: (): string[] => {
    const { selectedCells } = get();
    return Array.from(
      new Set(
        Array.from(selectedCells.values()).map(
          (cell) => cell.getContext().column.columnDef?.header?.toString() ?? ""
        )
      )
    );
  },

  getSelectedCellsAsPlain: (): SmartDrillCellSelection[] => {
    const { selectedCells } = get();
    return Array.from(selectedCells.values()).map((cell) => {
      const header = cell.column.columnDef?.header?.toString() ?? "";
      return {
        rowId: cell.row.id,
        columnId: cell.column.id,
        columnName: header,
        value: cell.getValue(),
        type: cell.column.columnDef?.meta?.["type"] ?? "",
      };
    });
  },

  navigateCell: (
    direction: "up" | "down" | "left" | "right",
    table: Table<unknown[]>
  ): Cell<unknown[], unknown> | null => {
    const state = get();
    const { anchorCell } = state;

    if (!anchorCell) {
      return null;
    }

    const rows = table.getRowModel().rows;
    const leafColumns = table.getVisibleLeafColumns();
    const currentRowIndex = rows.findIndex((r) => r.id === anchorCell.row.id);
    const currentColIndex = leafColumns.findIndex(
      (col) => col.id === anchorCell.column.id
    );

    if (
      currentColIndex === -1 ||
      currentRowIndex < 0 ||
      currentRowIndex >= rows.length
    ) {
      return null;
    }

    let newRowIndex = currentRowIndex;
    let newColIndex = currentColIndex;

    switch (direction) {
      case "up":
        newRowIndex = Math.max(0, currentRowIndex - 1);
        break;
      case "down":
        newRowIndex = Math.min(rows.length - 1, currentRowIndex + 1);
        break;
      case "left":
        newColIndex = Math.max(0, currentColIndex - 1);
        break;
      case "right":
        newColIndex = Math.min(leafColumns.length - 1, currentColIndex + 1);
        break;
    }

    // If no movement possible, return null
    if (newRowIndex === currentRowIndex && newColIndex === currentColIndex) {
      return null;
    }

    const newColumnId = leafColumns[newColIndex].id;
    const newRow = rows[newRowIndex];
    if (!newRow) {
      return null;
    }

    const newCell = newRow
      .getAllCells()
      .find((cell) => cell.column.id === newColumnId);
    if (!newCell) {
      return null;
    }

    // Update the selection to the new cell
    const newMap = new Map();
    newMap.set(newCell.id, newCell);
    set({
      selectedCells: newMap,
      anchorCell: newCell,
      matchedTables: [],
      isSmartDrillOpen: false,
    });

    return newCell;
  },

  selectRectangleWithDirection: (
    direction: "up" | "down" | "left" | "right",
    table: Table<unknown[]>
  ): void => {
    const state = get();
    const { anchorCell, selectedCells } = state;

    if (!anchorCell) {
      return;
    }

    const rows = table.getRowModel().rows;
    const leafColumns = table.getVisibleLeafColumns();

    // Find the current extent of selection
    let minRowIndex = rows.findIndex((r) => r.id === anchorCell.row.id);
    let maxRowIndex = minRowIndex;
    let minColIndex = leafColumns.findIndex(
      (col) => col.id === anchorCell.column.id
    );
    let maxColIndex = minColIndex;

    // If we already have multiple cells selected, find the current bounds
    if (selectedCells.size > 1) {
      const cells = Array.from(selectedCells.values());
      const rowIndices = cells.map((cell) =>
        rows.findIndex((r) => r.id === cell.row.id)
      );
      const colIndices = cells.map((cell) =>
        leafColumns.findIndex((col) => col.id === cell.column.id)
      );

      minRowIndex = Math.min(...rowIndices);
      maxRowIndex = Math.max(...rowIndices);
      minColIndex = Math.min(...colIndices);
      maxColIndex = Math.max(...colIndices);
    }

    // Extend the selection in the given direction
    switch (direction) {
      case "up":
        minRowIndex = Math.max(0, minRowIndex - 1);
        break;
      case "down":
        maxRowIndex = Math.min(rows.length - 1, maxRowIndex + 1);
        break;
      case "left":
        minColIndex = Math.max(0, minColIndex - 1);
        break;
      case "right":
        maxColIndex = Math.min(leafColumns.length - 1, maxColIndex + 1);
        break;
    }

    // Create selection coordinates for the rectangle
    const rectangleSelections = new Map<string, Cell<unknown[], unknown>>();
    for (let r = minRowIndex; r <= maxRowIndex; r++) {
      const row = rows[r];
      if (row) {
        for (let c = minColIndex; c <= maxColIndex; c++) {
          const columnId = leafColumns[c].id;
          const cell = row
            .getAllCells()
            .find((cell) => cell.column.id === columnId);
          if (cell) {
            rectangleSelections.set(cell.id, cell);
          }
        }
      }
    }

    set({
      selectedCells: rectangleSelections,
      anchorCell, // Keep the original anchor cell
      matchedTables: [],
      isSmartDrillOpen: false,
    });
  },
}));
