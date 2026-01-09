import React, { useMemo, useEffect, useRef } from "react";
import { FaTimes } from "react-icons/fa";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { useGlobalContextMenuStore } from "../../../store/globalContextMenuStore";
import { useSmartDrillStore } from "../../../store/smartDrillStore";
import { useTabStore } from "../../../store/tabStore";
import { getVSCodeAPI } from "../../../utils/vscode";
import QueryTab from "./QueryTab";
import styles from "./QueryTabList.module.css";
import { TabContextMenu } from "./TabContextMenu";

const QueryTabList: React.FC = () => {
  const setContextMenu = useGlobalContextMenuStore(
    (state) => state.setContextMenu
  );
  const tabContextMenu = useGlobalContextMenuStore((state) =>
    state.contextMenu?.type === "tab" ? state.contextMenu : null
  );

  const tabLength = useTabStore((state) => state.tabs.length);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const selectedBaseTabId = useTabStore((state) => state.selectedBaseTabId);
  const selectedComparisonTabId = useTabStore(
    (state) => state.selectedComparisonTabId
  );
  const closeTab = useTabStore((state) => state.closeTab);
  const setActiveTab = useTabStore((state) => state.setActiveTab);

  // Track previous activeTabId to send to extension
  const previousActiveTabId = useRef<string | null>(null);

  // Subscribe to activeTabId changes and notify extension
  useEffect(() => {
    const unsubscribe = useTabStore.subscribe((state) => {
      if (
        state.activeTabId &&
        state.activeTabId !== previousActiveTabId.current
      ) {
        const vscodeApi = getVSCodeAPI();
        vscodeApi.postMessage({
          type: "wv.setActiveTab",
          payload: {
            activeTabId: state.activeTabId,
            previousTabId: previousActiveTabId.current ?? undefined,
          },
        });
        previousActiveTabId.current = state.activeTabId;
      }
    });

    return unsubscribe;
  }, []);

  const handleTabClose = (
    e: React.MouseEvent<HTMLButtonElement>,
    tabId: string
  ): void => {
    closeTab(tabId);
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    tabId: string,
    tabIndex: number
  ): void => {
    e.preventDefault();
    setContextMenu({
      type: "tab",
      x: e.clientX,
      y: e.clientY,
      tabId,
      tabIndex,
    });
  };

  const activeTabIndex = useMemo(() => {
    const tabs = useTabStore.getState().tabs;
    const index = tabs.findIndex((tab) => tab.id === activeTabId);
    return index === -1 && tabs.length > 0 ? 0 : index;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, tabLength]); // tabLength ensures recalculation when tabs array changes

  const handleTabSelect = (index: number): void => {
    const tabId = useTabStore.getState().tabs[index].id;
    setActiveTab(tabId);
  };

  // Handle Escape key to clear smart drill selection
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        useSmartDrillStore.getState().clearSelection();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return (): void => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (tabLength === 0) {
    return null;
  }

  return (
    <>
      <Tabs
        className={styles.tabs}
        selectedIndex={activeTabIndex}
        onSelect={handleTabSelect}
        forceRenderTabPanel // Keep all tab panels mounted for state preservation
        onMouseDownCapture={(e) => {
          // prevent tab selection with right-click
          if (e.button === 2) {
            e.preventDefault();
          }
        }}
      >
        <TabList className={styles.tabList}>
          {Array.from({ length: tabLength }).map((_, index) => {
            const tab = useTabStore.getState().tabs[index];
            const key = `${tab.id}tab-${index}`;
            return (
              <Tab
                key={key}
                className={styles.tab}
                onContextMenu={(e) => handleContextMenu(e, tab.id, index)}
                tabIndex="0"
                onFocus={() => setActiveTab(tab.id)}
                name={tab.query}
                title={tab.id}
              >
                <span
                  title={tab.query}
                  className={`${styles.tabTitle} ${
                    selectedBaseTabId === tab.id
                      ? styles.baseTab
                      : selectedComparisonTabId === tab.id
                      ? styles.comparisonTab
                      : ""
                  }`}
                >
                  {tab.title}
                </span>
                <button
                  onClick={(e) => handleTabClose(e, tab.id)}
                  className={styles.closeButton}
                >
                  <FaTimes />
                </button>
              </Tab>
            );
          })}
        </TabList>

        {Array.from({ length: tabLength }).map((_, index) => {
          const tabId = useTabStore.getState().tabs[index]?.id;
          const key = `${tabId}panel-${index}`;
          return (
            <TabPanel
              key={key}
              className={`${
                tabId === activeTabId
                  ? styles.activeTabPanel
                  : styles.hiddenTabPanel
              }`}
            >
              <QueryTab tabId={tabId} />
            </TabPanel>
          );
        })}
      </Tabs>

      {tabContextMenu && (
        <TabContextMenu
          x={tabContextMenu.x}
          y={tabContextMenu.y}
          tabId={tabContextMenu.tabId}
          tabIndex={tabContextMenu.tabIndex}
          totalTabs={tabLength}
        />
      )}
    </>
  );
};

export default QueryTabList;
