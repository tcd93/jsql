import React, { useMemo, useState } from "react";
import { FaExchangeAlt, FaCheck, FaTimes, FaEye } from "react-icons/fa";
import { useTabStore } from "../../../../store/tabStore";
import { mapColumns, compareTabData } from "../../../../utils/comparisonUtils";
import styles from "./ComparisonControls.module.css";

interface ComparisonControlsProps {
  currentTabId: string;
}

const ComparisonControls: React.FC<ComparisonControlsProps> = ({
  currentTabId,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tabsLength = useTabStore((state) => state.tabs.length);
  const selectedBaseTabId = useTabStore((state) => state.selectedBaseTabId);
  const selectedComparisonTabId = useTabStore(
    (state) => state.selectedComparisonTabId
  );
  const getTab = useTabStore((state) => state.getTab);
  const setBaseTab = useTabStore((state) => state.setBaseTab);
  const compareWithSelectedTab = useTabStore(
    (state) => state.compareWithSelectedTab
  );
  const clearComparison = useTabStore((state) => state.clearComparison);

  const hasEnoughTabs = tabsLength >= 2;

  const isCurrentTabBase = selectedBaseTabId === currentTabId;
  const hasBaseTabSelected = selectedBaseTabId !== null;
  const isInComparisonMode =
    selectedBaseTabId &&
    selectedComparisonTabId &&
    currentTabId === selectedComparisonTabId;

  // Calculate comparison stats when in comparison mode
  const comparisonStats = useMemo(() => {
    if (!isInComparisonMode || !selectedBaseTabId || !selectedComparisonTabId) {
      return null;
    }

    const baseTab = getTab(selectedBaseTabId);
    const comparisonTab = getTab(selectedComparisonTabId);

    if (!baseTab || !comparisonTab) {
      return null;
    }

    // Use existing comparison utilities to calculate stats
    const columnMappings = mapColumns(baseTab.schema, comparisonTab.schema);
    const comparisonResult = compareTabData(
      baseTab.data,
      comparisonTab.data,
      columnMappings
    );

    // Determine which columns are matched and which are missing
    const matchedColumns = columnMappings.map((m) => m.columnName);
    const baseOnlyColumns = baseTab.schema
      .filter((col) => !matchedColumns.includes(col.name))
      .map((col) => col.name);
    const comparisonOnlyColumns = comparisonTab.schema
      .filter((col) => !matchedColumns.includes(col.name))
      .map((col) => col.name);

    return {
      totalDifferences: comparisonResult.differences.size,
      matchingColumns: columnMappings.length,
      baseTabTitle: baseTab.title,
      comparisonTabTitle: comparisonTab.title,
      matchedColumnNames: matchedColumns,
      baseOnlyColumns,
      comparisonOnlyColumns,
      totalRows: Math.max(baseTab.data.length, comparisonTab.data.length),
    };
  }, [isInComparisonMode, selectedBaseTabId, selectedComparisonTabId, getTab]);

  const handleButtonClick = (): void => {
    if (!hasEnoughTabs) {
      return;
    }
    if (isCurrentTabBase) {
      // If current tab is base, clear the comparison
      clearComparison();
    } else if (hasBaseTabSelected) {
      // If another tab is base, compare current tab with it
      compareWithSelectedTab(currentTabId);
    } else {
      // No base tab selected, set current tab as base
      setBaseTab(currentTabId);
    }
  };

  // Determine button appearance based on state
  const getButtonConfig = (): {
    icon: React.ComponentType<{ className?: string }>;
    className: string;
    title: string;
  } => {
    if (!hasEnoughTabs) {
      return {
        icon: FaCheck,
        className: styles.setBaseButton,
        title: "At least 2 tabs are required for comparison",
      };
    }
    if (isCurrentTabBase) {
      return {
        icon: FaTimes,
        className: styles.clearButton,
        title: "Clear comparison (currently set as base tab)",
      };
    } else if (hasBaseTabSelected) {
      return {
        icon: FaExchangeAlt,
        className: styles.compareButton,
        title: "Compare with base tab",
      };
    } else {
      return {
        icon: FaCheck,
        className: styles.setBaseButton,
        title: "Set as base tab for comparison",
      };
    }
  };

  const buttonConfig = getButtonConfig();
  const IconComponent = buttonConfig.icon;

  // If we're in comparison mode and have stats, show the tooltip instead of button
  if (isInComparisonMode && comparisonStats) {
    return (
      <button
        className={styles.comparisonInfoIcon}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => clearComparison()}
        disabled={!hasEnoughTabs}
        title="Hover for comparison details • Click to clear comparison"
      >
        <FaEye className={styles.infoIcon} />
        {showTooltip && (
          <div className={styles.comparisonTooltip}>
            <div className={styles.tooltipHeader}>
              Comparison: {comparisonStats.comparisonTabTitle} vs{" "}
              {comparisonStats.baseTabTitle}
            </div>
            <div className={styles.tooltipStats}>
              <div className={styles.statRow}>
                <strong>{comparisonStats.totalDifferences}</strong> differences
                in <strong>{comparisonStats.totalRows}</strong> rows
              </div>
              <div className={styles.statRow}>
                <strong>{comparisonStats.matchingColumns}</strong> columns
                compared
              </div>
            </div>

            {comparisonStats.matchedColumnNames.length > 0 && (
              <div className={styles.tooltipSection}>
                <div className={styles.sectionTitle}>Matched columns:</div>
                <div className={styles.columnList}>
                  {comparisonStats.matchedColumnNames.join(", ")}
                </div>
              </div>
            )}

            {comparisonStats.baseOnlyColumns.length > 0 && (
              <div className={styles.tooltipSection}>
                <div className={styles.sectionTitle}>Only in base:</div>
                <div className={styles.columnList}>
                  {comparisonStats.baseOnlyColumns.join(", ")}
                </div>
              </div>
            )}

            {comparisonStats.comparisonOnlyColumns.length > 0 && (
              <div className={styles.tooltipSection}>
                <div className={styles.sectionTitle}>Only in comparison:</div>
                <div className={styles.columnList}>
                  {comparisonStats.comparisonOnlyColumns.join(", ")}
                </div>
              </div>
            )}
          </div>
        )}
      </button>
    );
  }

  // Otherwise show the comparison control button
  return (
    <div className={styles.comparisonControls}>
      <button
        className={`${styles.controlButton} ${buttonConfig.className}`}
        onClick={handleButtonClick}
        disabled={!hasEnoughTabs}
        title={buttonConfig.title}
      >
        <IconComponent className={styles.icon} />
      </button>
    </div>
  );
};

export default ComparisonControls;
