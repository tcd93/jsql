import { SchemaField } from "@src/types";
import { generateQueryTitle } from "@src/utils";
import { ExpandedState } from "@tanstack/react-table";
import { Subject } from "rxjs";
import { create } from "zustand";
import { useGlobalContextMenuStore } from "./globalContextMenuStore";
import { useSmartDrillStore } from "./smartDrillStore";

interface StreamStats {
  rows: number;
  batches?: number;
  complete: boolean;
  affectedRows?: number[];
}

export class GroupedColumn {
  constructor(public id: string, public header: string) {}

  public toJson(): string {
    return JSON.stringify({
      id: this.id,
      header: this.header,
    });
  }

  static fromJson(json: string): GroupedColumn {
    const obj = JSON.parse(json);
    return new GroupedColumn(obj.id, obj.header);
  }
}

export interface TabData {
  id: string;
  title: string;
  query: string;
  queryId: string;
  schema: SchemaField[];
  data: unknown[][];
  /**
   * Emits when new data is appended to any tab
   */
  dataStream: Subject<unknown[][]>;
  error?: string;
  timestamp: number;
  streamStats?: StreamStats;
  isLoading: boolean;
  isCancelled: boolean;
  /** Grouped column names */
  groupedColumns: GroupedColumn[];
  /** Pinned column names */
  pinnedColumns: string[];
  /** Column order IDs */
  columnOrder: string[];
  /** Expanded state */
  expandedState: ExpandedState;
}

interface TabState {
  tabs: TabData[];
  activeTabId: string | null;
  selectedBaseTabId: string | null;
  selectedComparisonTabId: string | null;
  addTab: (query: string, queryId: string, tabId: string) => void;
  getTab: (id: string) => TabData | undefined;
  getTabsByQueryId: (queryId: string) => TabData[];
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (
    id: string,
    args: Omit<Partial<TabData>, "id" | "queryId" | "data">
  ) => void;
  appendData: (id: string, data: unknown[][]) => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  closeTabsToLeft: (id: string) => void;
  closeAllTabs: () => void;
  getActiveTab: () => TabData | null;
  setBaseTab: (id: string) => void;
  clearComparison: () => void;
  compareWithSelectedTab: (id: string) => void;
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  selectedBaseTabId: null,
  selectedComparisonTabId: null,
  comparisonMode: false,

  addTab: (query: string, queryId: string, tabId: string): void => {
    if (get().tabs.find((tab) => tab.id === tabId)) {
      console.warn(`Tab with id ${tabId} already exists`);
      return;
    }

    const newTab: TabData = {
      id: tabId,
      title: generateQueryTitle(query),
      query,
      queryId,
      data: [],
      dataStream: new Subject<unknown[][]>(),
      schema: [],
      timestamp: Date.now(),
      isLoading: true,
      isCancelled: false,
      groupedColumns: [],
      pinnedColumns: [],
      columnOrder: [],
      expandedState: {},
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
    }));

    // clear smart drill store
    useSmartDrillStore.getState().clearSelection();
  },

  closeTab: (id: string): void => {
    set((state) => {
      const tabIndex = state.tabs.findIndex((tab) => tab.id === id);
      if (tabIndex === -1) {
        return state;
      }

      const newTabs = [...state.tabs];
      newTabs.splice(tabIndex, 1);

      let newActiveTabId;
      if (id === state.activeTabId) {
        // If we're closing the active tab, activate the next tab or the previous one if there's no next
        if (newTabs.length > 0) {
          const newIndex = Math.min(tabIndex, newTabs.length - 1);
          newActiveTabId = newTabs[newIndex].id;
        } else {
          newActiveTabId = null;
        }
      }

      // clear smart drill store
      useSmartDrillStore.getState().clearSelection();
      // close context menu if open
      useGlobalContextMenuStore.getState().closeContextMenu();

      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
      };
    });
  },

  setActiveTab: (id: string): void => {
    // clear smart drill store
    useSmartDrillStore.getState().clearSelection();
    set({ activeTabId: id });
  },

  updateTab: (id, args): void => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, ...args } : tab
      ),
    }));
  },

  appendData: (id, data): void => {
    set((state) => {
      const tab = state.tabs.find((tab) => tab.id === id);
      if (!tab) {
        return state;
      }
      tab.data = [...tab.data, ...data];

      tab.dataStream.next(data);

      return { tabs: [...state.tabs] };
    });
  },

  getTab: (id: string): TabData | undefined => {
    return get().tabs.find((tab) => tab.id === id);
  },

  getTabsByQueryId: (queryId: string): TabData[] => {
    return get().tabs.filter((tab) => tab.queryId === queryId);
  },

  closeOtherTabs: (id: string): void => {
    set((state) => {
      const tabToKeep = state.tabs.find((tab) => tab.id === id);
      if (!tabToKeep) {
        return state;
      }

      return {
        tabs: [tabToKeep],
        activeTabId: id,
      };
    });
    // clear smart drill store
    useSmartDrillStore.getState().clearSelection();
    // close context menu if open
    useGlobalContextMenuStore.getState().closeContextMenu();
  },

  closeTabsToRight: (id: string): void => {
    set((state) => {
      const tabIndex = state.tabs.findIndex((tab) => tab.id === id);
      if (tabIndex === -1) {
        return state;
      }

      const newTabs = state.tabs.slice(0, tabIndex + 1);
      const newActiveTabId = newTabs.find((tab) => tab.id === state.activeTabId)
        ? state.activeTabId
        : id;

      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
      };
    });
    // clear smart drill store
    useSmartDrillStore.getState().clearSelection();
    // close context menu if open
    useGlobalContextMenuStore.getState().closeContextMenu();
  },

  closeTabsToLeft: (id: string): void => {
    set((state) => {
      const tabIndex = state.tabs.findIndex((tab) => tab.id === id);
      if (tabIndex === -1) {
        return state;
      }

      const newTabs = state.tabs.slice(tabIndex);
      const newActiveTabId = newTabs.find((tab) => tab.id === state.activeTabId)
        ? state.activeTabId
        : id;

      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
      };
    });
    // clear smart drill store
    useSmartDrillStore.getState().clearSelection();
    // close context menu if open
    useGlobalContextMenuStore.getState().closeContextMenu();
  },

  closeAllTabs: (): void => {
    useGlobalContextMenuStore.getState().closeContextMenu();
    set({
      tabs: [],
      activeTabId: null,
    });
  },

  getActiveTab: (): TabData | null => {
    const { tabs, activeTabId } = get();
    return tabs.find((tab) => tab.id === activeTabId) ?? null;
  },

  setBaseTab: (id: string): void => {
    set({
      selectedBaseTabId: id,
      selectedComparisonTabId: null,
    });
  },

  clearComparison: (): void => {
    set({
      selectedBaseTabId: null,
      selectedComparisonTabId: null,
    });
  },

  compareWithSelectedTab: (id: string): void => {
    const { selectedBaseTabId } = get();
    if (selectedBaseTabId && selectedBaseTabId !== id) {
      set({
        selectedComparisonTabId: id,
        activeTabId: id,
      });
    }
  },
}));
