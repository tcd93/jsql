import { Cell } from "@tanstack/react-table";
import React from "react";
import commonCellStyles from "../Cell/Cell.common.module.css";
import styles from "./RowNumberCell.module.css";

export const RowNumberCell = ({
  cell,
  rowIndex,
}: {
  cell: Cell<unknown[], unknown>;
  rowIndex: number;
}): React.JSX.Element => {
  const column = cell.column;
  const isPinned = column.getIsPinned();
  const offset: React.CSSProperties = isPinned
    ? {
        left: `${column.getStart("left")}px`,
        position: "sticky",
        zIndex: 1,
      }
    : {};

  const table = cell.getContext().table;
  const header = table.getFlatHeaders().find((h) => h.column.id === column.id);

  return (
    <td
      key={cell.id}
      className={`${commonCellStyles.virtualCell} ${
        isPinned ? commonCellStyles.pinned : ""
      }`}
      style={{
        width: `calc(var(--col-${column.id}-size) * 1px)`,
        ...offset,
      }}
      title={rowIndex.toString()}
    >
      {rowIndex}
      {header && column.getCanResize() && (
        <div
          className={styles.resizer}
          role="button"
          tabIndex={0}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onDoubleClick={() => column.resetSize()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault(); // Prevent scrolling
              table.setColumnSizing((currentSizes) => {
                const currentColSize = currentSizes[column.id] || 0;
                const newSizes = { ...currentSizes };
                newSizes[column.id] =
                  e.key === "ArrowLeft"
                    ? Math.max(currentColSize - 5, 5)
                    : currentColSize + 5;
                return newSizes;
              });
            }
          }}
          draggable
          onDragStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        />
      )}
    </td>
  );
};
