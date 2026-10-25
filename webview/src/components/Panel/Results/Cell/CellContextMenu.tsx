import React from "react";
import { createPortal } from "react-dom";
import { useMenuContext } from "../../../../hooks/useMenuContext";
import { copySelectedCells } from "../../../../services/ClipboardService";
import { startSmartDrill } from "../../../../services/SmartDrillService";
import { useGlobalContextMenuStore } from "../../../../store/globalContextMenuStore";
import { useSchemaStore } from "../../../../store/schemaStore";
import { useSmartDrillStore } from "../../../../store/smartDrillStore";
import styles from "./CellContextMenu.module.css";

interface CellContextMenuProps {
  x: number;
  y: number;
}

export const CellContextMenu: React.FC<CellContextMenuProps> = ({ x, y }) => {
  // Adjust position to keep menu within viewport
  const adjustedX = Math.min(x, window.innerWidth - 160); // 160px is menu width
  const adjustedY = Math.min(y, window.innerHeight - 60); // 60px is approximate menu height

  const { menuRef } = useMenuContext();
  const closeContextMenu = useGlobalContextMenuStore(
    (state) => state.closeContextMenu
  );
  const isSchemaLoading = useSchemaStore((state) => state.isLoading);
  const isSmartDrillLoading = useSmartDrillStore((state) => state.isLoading);

  const handleSmartDrill = async (): Promise<void> => {
    try {
      await startSmartDrill();
    } finally {
      closeContextMenu();
    }
  };

  const menu = (
    <>
      <div
        ref={menuRef}
        className={styles.contextMenu}
        style={{
          left: adjustedX,
          top: adjustedY,
        }}
        role="menu"
        tabIndex={0}
      >
        <button
          className={styles.menuItem}
          role="menuitem"
          onClick={async () => {
            await copySelectedCells();
            closeContextMenu();
          }}
        >
          Copy Selected Cells
        </button>
        <button
          className={styles.menuItem}
          role="menuitem"
          onClick={handleSmartDrill}
          disabled={isSchemaLoading || isSmartDrillLoading}
          title={
            isSchemaLoading
              ? "Loading schema data..."
              : isSmartDrillLoading
              ? "Performing smart drill analysis..."
              : undefined
          }
        >
          Smart drill
        </button>
      </div>
    </>
  );

  return createPortal(menu, document.body);
};
