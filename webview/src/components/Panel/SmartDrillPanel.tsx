import { SmartDrillTableRequest } from "@src/types";
import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { useSmartDrill } from "../../hooks/useSmartDrill";
import { useSmartDrillStore } from "../../store/smartDrillStore";
import styles from "./SmartDrillPanel.module.css";

interface SmartDrillPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SmartDrillPanel: React.FC<SmartDrillPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const { matchedTables, isLoading, setSmartDrillOpen, setLoading } =
    useSmartDrillStore();
  const { generateSmartDrillQuery } = useSmartDrill();
  const [filterText, setFilterText] = useState("");

  // Filter tables based on search text
  const filteredTables: SmartDrillTableRequest[] =
    ((): SmartDrillTableRequest[] => {
      if (!filterText.trim()) {
        return matchedTables;
      }

      const searchLower = filterText.toLowerCase();
      return matchedTables.filter((table) => {
        const fullQualifiedName =
          `${table.tableSchema}.${table.tableName}`.toLowerCase();
        const catalogQualifiedName =
          `${table.tableCatalog}.${table.tableSchema}.${table.tableName}`.toLowerCase();

        return (
          table.tableName.toLowerCase().includes(searchLower) ||
          table.tableSchema.toLowerCase().includes(searchLower) ||
          table.tableCatalog.toLowerCase().includes(searchLower) ||
          fullQualifiedName.includes(searchLower) ||
          catalogQualifiedName.includes(searchLower)
        );
      });
    })();

  if (!isOpen) {
    return null;
  }

  const handleTableClick = (table: SmartDrillTableRequest): void => {
    generateSmartDrillQuery(table);
    setSmartDrillOpen(false);
  };

  const handleClose = (): void => {
    setSmartDrillOpen(false);
    setLoading(false);
    onClose();
  };

  return (
    <div className={styles.smartDrillOverlay}>
      <div className={styles.smartDrillPanel}>
        <div className={styles.smartDrillHeader}>
          <h3>Smart Drill Analysis</h3>
          <button className={styles.closeBtn} onClick={handleClose}>
            <FaTimes />
          </button>
        </div>

        <div className={styles.smartDrillContent}>
          {isLoading ? (
            <div className={styles.loading}>
              Finding tables with matching columns...
            </div>
          ) : matchedTables.length > 0 ? (
            <div className={styles.tableSelection}>
              <p>
                {filterText.trim()
                  ? `Showing ${filteredTables.length} of ${matchedTables.length} tables matching your filter.`
                  : `Found ${matchedTables.length} tables with matching columns.`}{" "}
                Select one to generate a query:
              </p>

              {/* Filter input */}
              <div className={styles.filterContainer}>
                <input
                  type="text"
                  placeholder="Search tables (searches across catalog, schema, and table name)..."
                  className={styles.filterInput}
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />
              </div>

              <div
                className={styles.tableList}
                key={`filter-${filterText}-${filteredTables.length}`}
              >
                {filteredTables.length > 0 ? (
                  filteredTables.map((table) => (
                    <div
                      key={`${table.tableSchema}.${table.tableName}`}
                      className={styles.tableOption}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleTableClick(table);
                        }
                      }}
                      onClick={() => handleTableClick(table)}
                    >
                      <h4>
                        {table.tableSchema}.{table.tableName}
                      </h4>
                      <p>
                        Catalog: {table.tableCatalog} | Matching columns:{" "}
                        {table.matchingColumns}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className={styles.noFilterResults}>
                    No tables match your filter criteria.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.noResults}>
              No tables found with matching columns for smart drill.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartDrillPanel;
