import { ExportDataSuccessMessage, ExportDataErrorMessage } from "@src/types";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaDownload, FaChevronDown } from "react-icons/fa";
import { useMessageHandlerStore } from "../../../../events/messageHandlerStore";
import { useGlobalContextMenuStore } from "../../../../store/globalContextMenuStore";
import { useTabStore } from "../../../../store/tabStore";
import { exportTableData } from "../../../../utils/exportUtils";
import styles from "./ExportButton.module.css";
import { ExportDropdownMenu } from "./ExportDropdownMenu";

interface ExportButtonProps {
  currentTabId: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({ currentTabId }) => {
  const [isExporting, setIsExporting] = useState(false);

  const tabSchema = useTabStore((state) => state.getTab(currentTabId)?.schema);
  const isLoading = useTabStore(
    (state) => state.getTab(currentTabId)?.isLoading ?? false
  );
  const registerHandler = useMessageHandlerStore(
    (state) => state.registerHandler
  );
  const setContextMenu = useGlobalContextMenuStore(
    (state) => state.setContextMenu
  );
  const closeContextMenu = useGlobalContextMenuStore(
    (state) => state.closeContextMenu
  );
  const isExportDropdownOpen = useGlobalContextMenuStore((state) =>
    state.isExportDropdownOpen(currentTabId)
  );

  // Handle export success/error messages
  const handleExportSuccess = useCallback(
    (_: ExportDataSuccessMessage) => {
      setIsExporting(false);
      closeContextMenu();
    },
    [closeContextMenu]
  );

  const handleExportError = useCallback(
    (_: ExportDataErrorMessage) => {
      setIsExporting(false);
      closeContextMenu();
    },
    [closeContextMenu]
  );

  // Handle markdown copy success
  const handleMarkdownCopySuccess = useCallback(
    (event: CustomEvent<{ tabId: string }>): void => {
      // Only close if it's for the current tab
      if (event.detail.tabId === currentTabId) {
        closeContextMenu();
      }
    },
    [closeContextMenu, currentTabId]
  );

  // Register message handlers
  useEffect(() => {
    registerHandler("ext.exportDataSuccess", handleExportSuccess);
    registerHandler("ext.exportDataError", handleExportError);
  }, [registerHandler, handleExportSuccess, handleExportError]);

  // Register custom event listener for markdown copy success
  useEffect(() => {
    window.addEventListener(
      "markdownCopySuccess",
      handleMarkdownCopySuccess as EventListener
    );
    return (): void => {
      window.removeEventListener(
        "markdownCopySuccess",
        handleMarkdownCopySuccess as EventListener
      );
    };
  }, [handleMarkdownCopySuccess]);

  const handleQuickCSVExport = async (): Promise<void> => {
    if (!tabSchema || isExporting) {
      return;
    }
    const tabData = useTabStore.getState().getTab(currentTabId)?.data;
    if (!tabData) {
      return;
    }

    setIsExporting(true);

    try {
      await exportTableData(tabData, tabSchema, {
        format: "csv",
        includeHeaders: true,
      });
    } catch (error) {
      console.error("Export failed:", error);
      setIsExporting(false);
    }
  };

  const toggleDropdown = (event: React.MouseEvent): void => {
    if (!isLoading && !isExporting) {
      event.preventDefault();
      event.stopPropagation();

      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const x = rect.left;
      const y = rect.bottom + 4; // Add small gap below button

      if (isExportDropdownOpen) {
        closeContextMenu();
      } else {
        setContextMenu({
          type: "export",
          x,
          y,
          tabId: currentTabId,
        });
      }
    }
  };

  const isButtonDisabled = useMemo(
    () => isLoading || isExporting,
    [isLoading, isExporting]
  );
  const buttonTitle = useMemo(
    () =>
      isButtonDisabled
        ? isLoading
          ? "Loading data..."
          : "No data to export"
        : "Export data",
    [isButtonDisabled, isLoading]
  );

  const exportDropdownMenu = useGlobalContextMenuStore((state) =>
    state.contextMenu?.type === "export" ? state.contextMenu : null
  );

  return (
    <>
      <div className={styles.exportButton}>
        {/* Main Export Button (Quick CSV Export) */}
        <button
          className={`${styles.mainButton} ${
            isButtonDisabled ? styles.disabled : ""
          }`}
          onClick={handleQuickCSVExport}
          disabled={isButtonDisabled}
          title={buttonTitle}
        >
          {isExporting ? (
            <span className={styles.spinner} />
          ) : (
            <FaDownload className={styles.icon} />
          )}
        </button>

        {/* Dropdown Toggle Button */}
        <button
          className={`${styles.dropdownToggle} ${
            isButtonDisabled ? styles.disabled : ""
          } ${isExportDropdownOpen ? styles.open : ""}`}
          onClick={toggleDropdown}
          disabled={isButtonDisabled}
          title="More export options"
          data-export-dropdown-toggle="true"
        >
          <FaChevronDown className={styles.chevronIcon} />
        </button>
      </div>
      {exportDropdownMenu && (
        <ExportDropdownMenu
          x={exportDropdownMenu.x}
          y={exportDropdownMenu.y}
          tabId={exportDropdownMenu.tabId}
        />
      )}
    </>
  );
};

export default ExportButton;
