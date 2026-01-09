import React, { useState } from "react";
import { FaTable, FaChartBar } from "react-icons/fa";
import { useMenuContext } from "../../../../hooks/useMenuContext";
import { useTabStore } from "../../../../store/tabStore";
import { exportTableData, ExportFormat } from "../../../../utils/exportUtils";
import styles from "./ExportDropdownMenu.module.css";

interface ExportDropdownMenuProps {
  x: number;
  y: number;
  tabId: string;
}

interface ExportOption {
  format: ExportFormat;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  tooltip?: string;
}

const exportOptions: ExportOption[] = [
  {
    format: "csv",
    label: "Export as CSV",
    icon: FaTable,
    tooltip: "Export data as CSV file",
  },
  {
    format: "excel",
    label: "Export as Excel Table",
    icon: FaTable,
    tooltip: "Export data as Excel table with filtering and sorting",
  },
  {
    format: "markdown",
    label: "Copy to Markdown Table",
    icon: FaTable,
    tooltip: "Copy data as markdown table to clipboard",
  },
  {
    format: "data-wrangler",
    label: "Open in Data Wrangler",
    icon: FaChartBar,
    tooltip: "Export to CSV and open in Data Wrangler for analysis",
  },
];

export const ExportDropdownMenu: React.FC<ExportDropdownMenuProps> = ({
  x,
  y,
  tabId,
}) => {
  const getTab = useTabStore((state) => state.getTab);
  const { menuRef } = useMenuContext();
  const [markdownRowCount, setMarkdownRowCount] = useState<number>(10);

  const currentTab = getTab(tabId);
  const hasData = currentTab?.data && currentTab.data.length > 0;

  const handleExport = async (format: ExportFormat): Promise<void> => {
    if (!currentTab || !hasData) {
      return;
    }

    try {
      await exportTableData(currentTab.data, currentTab.schema, {
        format,
        includeHeaders: true,
        ...(format === "markdown" && {
          maxRows: markdownRowCount,
          tabId,
        }),
      });
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      className={styles.contextMenu}
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      tabIndex={0}
      ref={menuRef}
    >
      {exportOptions.map((option) => (
        <div key={option.format}>
          {option.format === "markdown" ? (
            <button
              className={`${styles.menuItem} ${
                option.disabled ? styles.disabled : ""
              }`}
              role="menuitem"
              onClick={(e) => {
                // Don't trigger export if clicking on the input field
                if ((e.target as HTMLElement).tagName === "INPUT") {
                  return;
                }
                if (!option.disabled) {
                  handleExport(option.format);
                }
              }}
              disabled={option.disabled}
              title={option.tooltip}
            >
              {option.icon && <option.icon />}
              <span>Copy</span>
              <input
                min="1"
                value={markdownRowCount}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value) && value > 0) {
                    setMarkdownRowCount(value);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className={styles.rowCountInput}
                title="Number of rows to copy"
              />
              <span>rows to markdown</span>
            </button>
          ) : (
            <button
              className={`${styles.menuItem} ${
                option.disabled ? styles.disabled : ""
              }`}
              role="menuitem"
              onClick={() => !option.disabled && handleExport(option.format)}
              disabled={option.disabled}
              title={option.tooltip}
            >
              {option.icon && <option.icon className={styles.optionIcon} />}
              <span>{option.label}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
