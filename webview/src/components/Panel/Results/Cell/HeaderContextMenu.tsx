import { Header } from "@tanstack/react-table";
import React from "react";
import { createPortal } from "react-dom";
import { useMenuContext } from "../../../../hooks/useMenuContext";
import { copySelectedCells } from "../../../../services/ClipboardService";
import { useGlobalContextMenuStore } from "../../../../store/globalContextMenuStore";
import { useSmartDrillStore } from "../../../../store/smartDrillStore";
import styles from "./CellContextMenu.module.css";

interface CellContextMenuProps {
  x: number;
  y: number;
  header: Header<unknown[], unknown>;
}

export const HeaderContextMenu: React.FC<CellContextMenuProps> = ({
  x,
  y,
  header,
}) => {
  // Adjust position to keep menu within viewport
  const adjustedX = Math.min(x, window.innerWidth - 160); // 160px is menu width
  const adjustedY = Math.min(y, window.innerHeight - 60); // 60px is approximate menu height

  const { menuRef } = useMenuContext();
  const { selectColumn } = useSmartDrillStore();
  const closeContextMenu = useGlobalContextMenuStore(
    (state) => state.closeContextMenu
  );

  const handleCopyColumn = async (): Promise<void> => {
    selectColumn(header);
    await copySelectedCells();
    closeContextMenu();
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
          onClick={handleCopyColumn}
        >
          Copy Column
        </button>
      </div>
    </>
  );

  return createPortal(menu, document.body);
};
