import React from "react";
import { useTabStore } from "../../../../store/tabStore";
import styles from "./PinDropdownMenu.module.css";

interface PinDropdownMenuProps {
  x: number;
  y: number;
  tabId: string;
}

export const PinDropdownMenu: React.FC<PinDropdownMenuProps> = ({
  x,
  y,
  tabId,
}) => {
  const tabSchema = useTabStore((state) => state.getTab(tabId)?.schema);
  const pinnedColumns = useTabStore(
    (state) => state.getTab(tabId)?.pinnedColumns
  );
  const updateTab = useTabStore((state) => state.updateTab);

  const handleColumnToggle = (columnName: string): void => {
    // remove if already pinned
    if (pinnedColumns?.includes(columnName)) {
      const newPinnedColumns = pinnedColumns.filter(
        (col) => col !== columnName
      );
      updateTab(tabId, { pinnedColumns: newPinnedColumns });
    } else {
      // add
      updateTab(tabId, {
        pinnedColumns: [...new Set([...(pinnedColumns ?? []), columnName])],
      });
    }
  };

  if (!tabSchema || tabSchema.length === 0) {
    return null;
  }

  return (
    <div
      className={styles.contextMenu}
      style={{
        top: y,
        left: x,
      }}
      role="menu"
    >
      {tabSchema.map((field) => (
        <div
          key={field.name}
          className={styles.menuItem}
          onClick={() => handleColumnToggle(field.name)}
          role="menuitemcheckbox"
          aria-checked={pinnedColumns?.includes(field.name)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleColumnToggle(field.name);
            }
          }}
        >
          <input
            type="checkbox"
            checked={pinnedColumns?.includes(field.name)}
            readOnly
            className={styles.checkbox}
            tabIndex={-1} // Remove from tab order as the parent div handles interaction
          />
          <span title={field.name}>{field.name}</span>
        </div>
      ))}
    </div>
  );
};
