import React from "react";
import { createPortal } from "react-dom";
import { useMenuContext } from "../../../../hooks/useMenuContext";
import { copySelectedCells } from "../../../../services/ClipboardService";
import { useGlobalContextMenuStore } from "../../../../store/globalContextMenuStore";
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
      </div>
    </>
  );

  return createPortal(menu, document.body);
};
