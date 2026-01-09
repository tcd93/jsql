import React from "react";
import { useMenuContext } from "../../../hooks/useMenuContext";
import { useTabStore } from "../../../store/tabStore";
import styles from "./TabContextMenu.module.css";

interface TabContextMenuProps {
  x: number;
  y: number;
  tabId: string;
  tabIndex: number;
  totalTabs: number;
}

export const TabContextMenu: React.FC<TabContextMenuProps> = ({
  x,
  y,
  tabId,
  tabIndex,
  totalTabs,
}: TabContextMenuProps) => {
  const closeTab = useTabStore((state) => state.closeTab);
  const closeOtherTabs = useTabStore((state) => state.closeOtherTabs);
  const closeAllTabs = useTabStore((state) => state.closeAllTabs);
  const closeTabsToLeft = useTabStore((state) => state.closeTabsToLeft);
  const closeTabsToRight = useTabStore((state) => state.closeTabsToRight);

  const { menuRef } = useMenuContext();

  const canCloseToLeft = tabIndex > 0;
  const canCloseToRight = tabIndex < totalTabs - 1;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      className={styles.contextMenu}
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      tabIndex={0}
      ref={menuRef}
    >
      <button
        className={styles.menuItem}
        role="menuitem"
        onClick={() => closeTab(tabId)}
      >
        Close
      </button>
      <button
        className={styles.menuItem}
        role="menuitem"
        onClick={() => closeOtherTabs(tabId)}
        disabled={totalTabs <= 1}
      >
        Close Others
      </button>
      <div className={styles.separator} />
      <button
        className={styles.menuItem}
        role="menuitem"
        onClick={() => closeTabsToLeft(tabId)}
        disabled={!canCloseToLeft}
      >
        Close All to the Left
      </button>
      <button
        className={styles.menuItem}
        role="menuitem"
        onClick={() => closeTabsToRight(tabId)}
        disabled={!canCloseToRight}
      >
        Close All to the Right
      </button>
      <div className={styles.separator} />
      <button
        className={styles.menuItem}
        role="menuitem"
        onClick={() => closeAllTabs()}
      >
        Close All
      </button>
    </div>
  );
};
