import { SchemaField } from "@src/types";
import React, { useMemo } from "react";
import { FaSearch, FaTable } from "react-icons/fa";
import { startSmartDrill } from "../../../../services/SmartDrillService";
import { useFooterStore } from "../../../../store/footerStore";
import { useSchemaStore } from "../../../../store/schemaStore";
import { useSmartDrillStore } from "../../../../store/smartDrillStore";
import { GroupDropZone } from "../Table/GroupDropZone";
import ComparisonControls from "./ComparisonControls";
import ExportButton from "./ExportButton";
import PinButton from "./PinButton";
import styles from "./TableToolbar.module.css";

interface TableToolbarProps {
  searchText: string;
  setSearchText: (filter: string) => void;
  className?: string;
  tabId: string;
  schema: SchemaField[];
}

const TableToolbar: React.FC<TableToolbarProps> = ({
  searchText,
  setSearchText,
  tabId,
}) => {
  // Smart Drill state
  // Only subscribe to the length and loading state, not the entire array
  const selectedCellsCount = useSmartDrillStore(
    (state) => state.selectedCells.length
  );
  const isSchemaLoading = useSchemaStore((state) => state.isLoading);
  const isSmartDrillLoading = useSmartDrillStore((state) => state.isLoading);

  const hasSelectedCells = selectedCellsCount > 0;
  const showFooter = useFooterStore((state) => state.showFooter);
  const toggleFooter = useFooterStore((state) => state.toggleFooter);

  // Calculate unique columns only when we have selections - get fresh data when needed
  const uniqueColumns = useMemo(() => {
    if (selectedCellsCount === 0) {
      return 0;
    }
    const selectedCells = useSmartDrillStore.getState().selectedCells;
    return new Set(selectedCells.map((cell) => cell.column.id)).size;
  }, [selectedCellsCount]);

  return (
    <>
      <div className={styles.tableToolbar}>
        {/* Smart Drill Section */}
        {hasSelectedCells && (
          <div className={styles.leftSection}>
            <button
              className={styles.drillButton}
              onClick={startSmartDrill}
              disabled={isSmartDrillLoading || isSchemaLoading}
              title={
                isSchemaLoading
                  ? "Loading schema data..."
                  : isSmartDrillLoading
                  ? "Performing smart drill analysis..."
                  : "Perform smart drill analysis on selected cells"
              }
            >
              {isSmartDrillLoading || isSchemaLoading ? (
                <>
                  <span className={styles.spinner} />
                </>
              ) : (
                <>
                  <span className={styles.drillIcon}>🔍</span>
                </>
              )}
            </button>

            <div className={styles.selectionInfo}>
              <span className={styles.cellCount}>
                {selectedCellsCount} cell
                {selectedCellsCount !== 1 ? "s" : ""} selected
              </span>
              <span className={styles.columnCount}>
                ({uniqueColumns} unique column{uniqueColumns !== 1 ? "s" : ""})
              </span>
            </div>
          </div>
        )}

        <div className={styles.centerSection}>
          <GroupDropZone tabId={tabId} />
        </div>

        {/* Right Section */}
        <div className={styles.rightSection}>
          <ExportButton currentTabId={tabId} />
          <PinButton currentTabId={tabId} />
          <button
            className={`${styles.stickyFooterButton} ${
              showFooter ? styles.active : ""
            }`}
            onClick={toggleFooter}
            title={showFooter ? "Hide footer row" : "Show footer row"}
          >
            <FaTable className={styles.icon} />
          </button>
          <ComparisonControls currentTabId={tabId} />
          <FaSearch title="Search rows" />
          <input
            type="text"
            placeholder="Search..."
            onChange={(e) => {
              setSearchText(e.target.value);
            }}
            value={searchText}
          />
        </div>
      </div>
    </>
  );
};

export default TableToolbar;
