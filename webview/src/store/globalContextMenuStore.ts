import { create } from "zustand";

interface CellContextMenu {
  type: "cell";
  x: number;
  y: number;
  cellId: string;
}

interface TabContextMenu {
  type: "tab";
  x: number;
  y: number;
  tabId: string;
  tabIndex: number;
}

interface HeaderContextMenu {
  type: "header";
  x: number;
  y: number;
  columnId: string;
}

interface ExportDropdownMenu {
  type: "export";
  x: number;
  y: number;
  tabId: string;
}

interface PinDropdownMenu {
  type: "pin";
  x: number;
  y: number;
  tabId: string;
}

interface AggregationContextMenu {
  type: "aggregation";
  x: number;
  y: number;
  columnId: string;
}

type ContextMenu =
  | CellContextMenu
  | TabContextMenu
  | HeaderContextMenu
  | ExportDropdownMenu
  | PinDropdownMenu
  | AggregationContextMenu;

interface GlobalContextMenuState {
  contextMenu: ContextMenu | null;
  setContextMenu: (menu: ContextMenu | null) => void;
  closeContextMenu: () => void;
  isCellContextMenuOpen: (cellId: string) => boolean;
  isTabContextMenuOpen: () => boolean;
  isHeaderContextMenuOpen: (columnId: string) => boolean;
  isExportDropdownOpen: (tabId: string) => boolean;
  isPinDropdownOpen: (tabId: string) => boolean;
  isAggregationContextMenuOpen: (columnId: string) => boolean;
}

// Global click-outside handler setup
const handleClickOutside = (event: MouseEvent): void => {
  const target = event.target as Element;
  // Don't close if clicking inside the context menu
  if (target.closest('[role="menu"]')) {
    return;
  }
  // Don't close if clicking on export dropdown toggle
  if (target.closest('[data-export-dropdown-toggle="true"]')) {
    return;
  }
  // Don't close if clicking on pin dropdown toggle
  if (target.closest('[data-pin-dropdown-toggle="true"]')) {
    return;
  }
  // Close any open context menu
  useGlobalContextMenuStore.getState().closeContextMenu();
};

// Set up the global click handler once
document.addEventListener("click", handleClickOutside, true);

export const useGlobalContextMenuStore = create<GlobalContextMenuState>(
  (set, get) => ({
    contextMenu: null,
    setContextMenu: (menu): void => set({ contextMenu: menu }),
    closeContextMenu: (): void => {
      const { contextMenu } = get();
      if (contextMenu !== null) {
        set({ contextMenu: null });
      }
    },
    isCellContextMenuOpen: (cellId: string): boolean => {
      const { contextMenu } = get();
      return contextMenu?.type === "cell" && contextMenu.cellId === cellId;
    },
    isTabContextMenuOpen: (): boolean => {
      const { contextMenu } = get();
      return contextMenu?.type === "tab";
    },
    isHeaderContextMenuOpen: (columnId: string): boolean => {
      const { contextMenu } = get();
      return (
        contextMenu?.type === "header" && contextMenu.columnId === columnId
      );
    },
    isExportDropdownOpen: (tabId: string): boolean => {
      const { contextMenu } = get();
      return contextMenu?.type === "export" && contextMenu.tabId === tabId;
    },
    isPinDropdownOpen: (tabId: string): boolean => {
      const { contextMenu } = get();
      return contextMenu?.type === "pin" && contextMenu.tabId === tabId;
    },
    isAggregationContextMenuOpen: (columnId: string): boolean => {
      const { contextMenu } = get();
      return (
        contextMenu?.type === "aggregation" && contextMenu.columnId === columnId
      );
    },
  })
);
