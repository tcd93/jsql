import { AggregationOptions } from "@src/types";
import { Header } from "@tanstack/react-table";
import React from "react";
import { createPortal } from "react-dom";
import { useMenuContext } from "../../../../hooks/useMenuContext";
import { useGlobalContextMenuStore } from "../../../../store/globalContextMenuStore";
import { useTabStore } from "../../../../store/tabStore";
import styles from "./CellContextMenu.module.css";

interface AggregationContextMenuProps {
  x: number;
  y: number;
  header: Header<unknown[], unknown>;
}

export const AggregationContextMenu: React.FC<AggregationContextMenuProps> = ({
  x,
  y,
  header,
}) => {
  const { menuRef } = useMenuContext();
  const closeContextMenu = useGlobalContextMenuStore(
    (state) => state.closeContextMenu
  );
  const { activeTabId, getTab, updateTab } = useTabStore();

  const handleSelectAggregation = (
    fn: (typeof AggregationOptions)[number]
  ): void => {
    if (!activeTabId) {
      return;
    }

    const currentSchema = getTab(activeTabId)?.schema;
    if (!currentSchema) {
      return;
    }

    const updatedSchemaWithFn = currentSchema.map((field) => {
      if (field.name === header.column.columnDef.header) {
        return { ...field, aggregationFn: fn };
      }
      return field;
    });

    updateTab(activeTabId, { schema: updatedSchemaWithFn });
    closeContextMenu();
  };

  // Adjust position to keep menu within viewport
  // Default width 160 is likely too small for aggregation names if they are long, but they are short
  const adjustedX = Math.min(x, window.innerWidth - 160);
  // Menu height depends on number of options.
  const menuHeight = AggregationOptions.length * 36; // Approx
  const adjustedY = Math.min(y, window.innerHeight - menuHeight);

  // Determine key for aggregation function.
  // The 'aggregationFn' in columnDef can be a string (key) or a function.
  // Since we are setting it from AggregationOptions (strings), we compare against strings.
  const currentAggregationFn = header.column.columnDef.aggregationFn;

  const menu = (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{
        left: adjustedX,
        top: adjustedY,
        maxHeight: "300px", // Limit height if too many options
        overflowY: "auto",
      }}
      role="menu"
      tabIndex={0}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {AggregationOptions.map((option) => (
        <button
          key={option}
          className={styles.menuItem}
          data-selected={currentAggregationFn === option}
          style={{
            fontWeight: currentAggregationFn === option ? "bold" : "normal",
            backgroundColor:
              currentAggregationFn === option
                ? "var(--vscode-list-activeSelectionBackground)"
                : undefined,
            color:
              currentAggregationFn === option
                ? "var(--vscode-list-activeSelectionForeground)"
                : undefined,
          }}
          role="menuitem"
          onClick={() => handleSelectAggregation(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );

  return createPortal(menu, document.body);
};
