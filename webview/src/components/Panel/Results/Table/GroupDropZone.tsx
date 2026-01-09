import React, { useState } from "react";
import { GroupedColumn, useTabStore } from "../../../../store/tabStore";
import styles from "./GroupDropZone.module.css";

interface GroupDropZoneProps {
  tabId: string;
}

const GroupIcon = (): React.ReactElement => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    style={{ opacity: 0.7 }}
  >
    <path d="M14 4H2V3H14V4ZM14 8H2V7H14V8ZM14 12H2V11H14V12Z" />
  </svg>
);

export const GroupDropZone: React.FC<GroupDropZoneProps> = ({
  tabId,
}: GroupDropZoneProps) => {
  const [isActive, setIsActive] = useState(false);

  const groupedColumns = useTabStore(
    (state) => state.getTab(tabId)?.groupedColumns
  );
  const updateTab = useTabStore((state) => state.updateTab);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    // Must match the effectAllowed in HeaderCell (which is 'move')
    e.dataTransfer.dropEffect = "move";
    setIsActive(true);
  };

  const handleDragLeave = (): void => {
    setIsActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsActive(false);
    try {
      const data = e.dataTransfer.getData("text/plain");
      if (!data) {
        return;
      }
      const newGroup = GroupedColumn.fromJson(data);

      if (!newGroup) {
        return;
      }

      updateTab(tabId, {
        groupedColumns: [
          ...[...new Set([...(groupedColumns ?? []), newGroup])],
        ],
      });
    } catch (error) {
      console.error("Failed to parse drop data", error);
    }
  };

  const handleRemove = (header: GroupedColumn): void => {
    const newGroupedColumns = groupedColumns?.filter(
      (col) => col.id !== header.id
    );
    updateTab(tabId, { groupedColumns: newGroupedColumns });
  };

  return (
    <div
      className={`${styles.dropZone} ${isActive ? styles.active : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {groupedColumns?.length === 0 ? (
        <div className={styles.placeholderContainer}>
          <GroupIcon />
          <span className={styles.placeholder}>
            Drag a column header here to group
          </span>
        </div>
      ) : (
        groupedColumns?.map((column) => {
          return (
            <div key={column.id} className={styles.chip}>
              <span>{column.header}</span>
              <button
                className={styles.removeButton}
                onClick={() => handleRemove(column)}
                aria-label={`Remove grouping by ${column}`}
                title="Remove group"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"
                  />
                </svg>
              </button>
            </div>
          );
        })
      )}
    </div>
  );
};
