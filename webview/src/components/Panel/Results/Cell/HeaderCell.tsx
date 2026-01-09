import { AggregationOptions } from "@src/types";
import { Header, flexRender } from "@tanstack/react-table";
import React, { useCallback, useState } from "react";
import { useGlobalContextMenuStore } from "../../../../store/globalContextMenuStore";
import { useSmartDrillStore } from "../../../../store/smartDrillStore";
import { GroupedColumn, useTabStore } from "../../../../store/tabStore";
import { AggregationContextMenu } from "./AggregationContextMenu";
import styles from "./HeaderCell.module.css";
import { HeaderContextMenu } from "./HeaderContextMenu";

export const HeaderCell = ({
  header,
}: {
  header: Header<unknown[], unknown>;
  tableRef?: React.RefObject<HTMLDivElement | null>;
}): React.JSX.Element => {
  const contextMenu = useGlobalContextMenuStore((state) => state.contextMenu);
  const setContextMenu = useGlobalContextMenuStore(
    (state) => state.setContextMenu
  );
  const isContextMenuOpen = useGlobalContextMenuStore((state) =>
    state.isHeaderContextMenuOpen(header.column.id)
  );
  const isAggregationContextMenuOpen = useGlobalContextMenuStore((state) =>
    state.isAggregationContextMenuOpen(header.column.id)
  );
  const selectColumn = useSmartDrillStore((state) => state.selectColumn);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      setContextMenu({
        type: "header",
        x: event.clientX,
        y: event.clientY,
        columnId: header.column.id,
      });
    },
    [header.column.id, setContextMenu]
  );

  const handleHeaderDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      // Only select column if clicking on the header text area, not on icons
      const target = event.target as HTMLElement;
      if (
        target.closest(`.${styles.sortIcon}`) ||
        target.closest(`.${styles.aggregationIcon}`) ||
        target.closest(`.${styles.resizer}`)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      selectColumn(header);
    },
    [header, selectColumn]
  );

  const handleAggregationIconClick = useCallback(
    (header: Header<unknown[], unknown>) => {
      const { activeTabId, getTab, updateTab } = useTabStore.getState();
      if (!activeTabId) {
        return;
      }
      const currentSchema = getTab(activeTabId)?.schema;
      if (!currentSchema) {
        return;
      }
      const updatedSchemaWithFn = currentSchema.map((field) => {
        if (field.name === header.column.columnDef.header) {
          // Cycle through aggregation functions
          const currentFn = field.aggregationFn;
          if (!currentFn) {
            return { ...field, aggregationFn: AggregationOptions[0] };
          }
          const currentIndex = AggregationOptions.indexOf(currentFn);
          const nextIndex = (currentIndex + 1) % AggregationOptions.length;
          return { ...field, aggregationFn: AggregationOptions[nextIndex] };
        }
        return field;
      });
      updateTab(activeTabId, { schema: updatedSchemaWithFn });
    },
    []
  );

  const handleAggregationContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        type: "aggregation",
        x: event.clientX,
        y: event.clientY,
        columnId: header.column.id,
      });
    },
    [header.column.id, setContextMenu]
  );

  const handleDragStart = useCallback(
    (event: React.DragEvent) => {
      event.dataTransfer.setData(
        "text/plain",
        new GroupedColumn(
          header.column.id,
          header.column.columnDef.header?.toString() ?? ""
        ).toJson()
      );
      event.dataTransfer.effectAllowed = "move";
    },
    [header.column.columnDef.header, header.column.id]
  );
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    // Only clear if we're actually leaving the element (not entering a child)
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);

      try {
        const data = JSON.parse(event.dataTransfer.getData("text/plain"));
        const draggedColumnId = data.id;
        const targetColumnId = header.column.id;

        if (draggedColumnId === targetColumnId) {
          return;
        }

        const table = header.getContext().table;
        const currentOrder =
          table.getState().columnOrder.length > 0
            ? table.getState().columnOrder
            : table.getAllLeafColumns().map((c) => c.id);

        const draggedIndex = currentOrder.indexOf(draggedColumnId);
        const targetIndex = currentOrder.indexOf(targetColumnId);

        if (draggedIndex === -1 || targetIndex === -1) {
          return;
        }

        const newOrder = [...currentOrder];
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedColumnId);

        table.setColumnOrder(newOrder);
      } catch (error) {
        console.error("Failed to handle drop:", error);
      }
    },
    [header]
  );
  const isPinned = header.column.getIsPinned();
  const isGrouped = header.column.getIsGrouped();
  const isDraggable = !header.isPlaceholder && !isPinned && !isGrouped;

  const offset: React.CSSProperties = isPinned
    ? {
        left: `${header.column.getStart("left")}px`,
        position: "sticky",
        zIndex: 2, // Headers need higher z-index than data cells
      }
    : {};

  return (
    <>
      <th
        key={header.id}
        style={{
          width: `calc(var(--header-${header.id}-size) * 1px)`,
          ...offset,
        }}
        onDoubleClick={handleHeaderDoubleClick}
        onContextMenu={handleContextMenu}
        draggable={isDraggable}
        onDragStart={isDraggable ? handleDragStart : undefined}
        onDragOver={isDraggable ? handleDragOver : undefined}
        onDragLeave={isDraggable ? handleDragLeave : undefined}
        onDrop={isDraggable ? handleDrop : undefined}
      >
        <span
          className={`${styles.header} ${
            header.column.getIsSorted() ? styles.sorted : ""
          } ${isPinned ? styles.pinned : ""} ${
            isDragOver ? styles.dragOver : ""
          }`}
        >
          {header.isPlaceholder ? null : (
            <span className={styles.headerContent}>
              {flexRender(header.column.columnDef.header, header.getContext())}
            </span>
          )}
          {/* Aggregation function cycler icon, show if table is currently grouping */}
          <span className={styles.iconContainer}>
            {!header.isPlaceholder &&
              header.column.getCanGroup() &&
              !header.column.getIsGrouped() &&
              header.getContext().table.getState().grouping.length > 0 && (
                <span
                  className={styles.aggregationIcon}
                  role="button"
                  tabIndex={0}
                  title={`Aggregation: ${header.column.columnDef.aggregationFn?.toString()}`}
                  onClick={() => {
                    handleAggregationIconClick(header);
                  }}
                  onContextMenu={handleAggregationContextMenu}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleAggregationIconClick(header);
                    }
                  }}
                >
                  ∑
                </span>
              )}
            {header.column.getCanSort() && (
              <span
                className={styles.sortIcon}
                role="button"
                tabIndex={0}
                onClick={header.column.getToggleSortingHandler()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    header.column.getToggleSortingHandler()?.(e);
                  }
                }}
              >
                {header.column.getIsSorted() === "asc"
                  ? "↑"
                  : header.column.getIsSorted() === "desc"
                  ? "↓"
                  : "↕"}
              </span>
            )}
            {header.column.getCanResize() && (
              <span
                className={styles.resizer}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onMouseDown={header.getResizeHandler()}
                onTouchStart={header.getResizeHandler()}
                onDoubleClick={header.column.resetSize}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    header
                      .getContext()
                      .table.setColumnSizing((currentSizes) => {
                        const currentColSize =
                          currentSizes[header.column.id] || 0;
                        const newSizes = { ...currentSizes };
                        newSizes[header.column.id] =
                          e.key === "ArrowLeft"
                            ? Math.max(currentColSize - 5, 5)
                            : currentColSize + 5;
                        return newSizes;
                      });
                  }
                }}
              />
            )}
          </span>
        </span>
      </th>
      {contextMenu?.type === "header" && isContextMenuOpen && (
        <HeaderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          header={header}
        />
      )}
      {contextMenu?.type === "aggregation" && isAggregationContextMenuOpen && (
        <AggregationContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          header={header}
        />
      )}
    </>
  );
};
