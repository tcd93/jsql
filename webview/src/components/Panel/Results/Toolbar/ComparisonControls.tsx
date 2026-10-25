import React, { useEffect, useMemo, useState } from "react";
import { FaExchangeAlt, FaCheck, FaTimes, FaEye } from "react-icons/fa";
import { useComparisonResultStore } from "../../../../store/comparisonResultStore";
import { useTabStore } from "../../../../store/tabStore";
import { mapColumns } from "../../../../utils/comparisonUtils";
import styles from "./ComparisonControls.module.css";

interface ComparisonControlsProps {
  currentTabId: string;
}

const keyNamePriority = (name: string): number => {
  const normalizedName = name.trim().toLowerCase();
  const knownNames = ["_id", "id", "_key", "key", "_pk", "pk"];
  const knownNameIndex = knownNames.indexOf(normalizedName);
  if (knownNameIndex !== -1) {
    return knownNameIndex;
  }
  if (normalizedName.endsWith("_id")) {
    return knownNames.length;
  }
  if (normalizedName.endsWith("_key")) {
    return knownNames.length + 1;
  }
  if (normalizedName.endsWith("_pk")) {
    return knownNames.length + 1;
  }
  return Number.MAX_SAFE_INTEGER;
};

const ComparisonControls: React.FC<ComparisonControlsProps> = ({
  currentTabId,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [selectedKeyColumns, setSelectedKeyColumns] = useState<string[]>([]);
  const tabsLength = useTabStore((state) => state.tabs.length);
  const selectedBaseTabId = useTabStore((state) => state.selectedBaseTabId);
  const selectedComparisonTabId = useTabStore(
    (state) => state.selectedComparisonTabId,
  );
  const selectedComparisonKeyColumns = useTabStore(
    (state) => state.selectedComparisonKeyColumns,
  );
  const baseTab = useTabStore((state) =>
    selectedBaseTabId
      ? state.tabs.find((tab) => tab.id === selectedBaseTabId)
      : undefined,
  );
  const currentTab = useTabStore((state) =>
    state.tabs.find((tab) => tab.id === currentTabId),
  );
  const comparisonResult = useComparisonResultStore((state) =>
    state.comparisonTabId === currentTabId ? state.result : null,
  );
  const setBaseTab = useTabStore((state) => state.setBaseTab);
  const compareWithSelectedTab = useTabStore(
    (state) => state.compareWithSelectedTab,
  );
  const clearComparison = useTabStore((state) => state.clearComparison);

  const hasEnoughTabs = tabsLength >= 2;
  const isCurrentTabBase = selectedBaseTabId === currentTabId;
  const hasBaseTabSelected = selectedBaseTabId !== null;
  const isInComparisonMode =
    selectedBaseTabId !== null &&
    selectedComparisonTabId !== null &&
    currentTabId === selectedComparisonTabId;

  const commonColumns = useMemo(() => {
    if (!baseTab || !currentTab) {
      return [];
    }

    return mapColumns(baseTab.schema, currentTab.schema).sort(
      (left, right) =>
        keyNamePriority(left.columnName) - keyNamePriority(right.columnName) ||
        left.columnName.localeCompare(right.columnName),
    );
  }, [baseTab, currentTab]);

  const suggestedKey = commonColumns.find(
    (column) => keyNamePriority(column.columnName) < Number.MAX_SAFE_INTEGER,
  )?.columnName;

  useEffect(() => {
    if (!showKeyPicker) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setShowKeyPicker(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return (): void => document.removeEventListener("keydown", handleKeyDown);
  }, [showKeyPicker]);

  const comparisonStats = useMemo(() => {
    if (
      !isInComparisonMode ||
      !selectedBaseTabId ||
      !selectedComparisonTabId ||
      !baseTab
    ) {
      return null;
    }

    const comparisonTab = currentTab;
    if (comparisonTab?.id !== selectedComparisonTabId) {
      return null;
    }

    const columnMappings =
      comparisonResult?.columnMappings ??
      mapColumns(baseTab.schema, comparisonTab.schema);
    const matchedColumnNames = columnMappings.map(
      (mapping) => mapping.columnName,
    );
    const matchedNames = new Set(
      matchedColumnNames.map((name) => name.toLowerCase()),
    );

    return {
      totalDifferences: comparisonResult?.differences.size ?? 0,
      matchingColumns: columnMappings.length,
      baseTabTitle: baseTab.title,
      comparisonTabTitle: comparisonTab.title,
      matchedColumnNames,
      baseOnlyColumns: baseTab.schema
        .filter((column) => !matchedNames.has(column.name.toLowerCase()))
        .map((column) => column.name),
      comparisonOnlyColumns: comparisonTab.schema
        .filter((column) => !matchedNames.has(column.name.toLowerCase()))
        .map((column) => column.name),
      duplicateBaseRows: comparisonResult?.duplicateBaseRows.size ?? 0,
      duplicateComparisonRows:
        comparisonResult?.duplicateComparisonRows.size ?? 0,
      ambiguousBaseRows: comparisonResult?.ambiguousBaseRows.size ?? 0,
      ambiguousComparisonRows:
        comparisonResult?.ambiguousComparisonRows.size ?? 0,
      unmatchableBaseRows: comparisonResult?.unmatchableBaseRows.size ?? 0,
      unmatchableComparisonRows:
        comparisonResult?.unmatchableComparisonRows.size ?? 0,
      addedRows: comparisonResult?.unmatchedComparisonRows.size ?? 0,
      removedRows: comparisonResult?.unmatchedBaseRows ?? 0,
      matchedRows: comparisonResult?.matchedRows ?? 0,
      isUpdating: baseTab.isLoading || comparisonTab.isLoading,
      isReady: comparisonResult !== null,
    };
  }, [
    isInComparisonMode,
    selectedBaseTabId,
    selectedComparisonTabId,
    baseTab,
    currentTab,
    comparisonResult,
  ]);

  const handleButtonClick = (): void => {
    if (!hasEnoughTabs) {
      return;
    }
    if (isCurrentTabBase) {
      clearComparison();
    } else if (hasBaseTabSelected) {
      setSelectedKeyColumns(suggestedKey ? [suggestedKey] : []);
      setShowKeyPicker(true);
    } else {
      setBaseTab(currentTabId);
    }
  };

  const handleCompare = (): void => {
    if (selectedKeyColumns.length === 0) {
      return;
    }
    compareWithSelectedTab(currentTabId, selectedKeyColumns);
    setShowKeyPicker(false);
  };

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
    }
    if (hasBaseTabSelected) {
      return {
        icon: FaExchangeAlt,
        className: styles.compareButton,
        title: "Choose key columns and compare with the base tab",
      };
    }
    return {
      icon: FaCheck,
      className: styles.setBaseButton,
      title: "Set as base tab for comparison",
    };
  };

  const buttonConfig = getButtonConfig();
  const IconComponent = buttonConfig.icon;

  if (isInComparisonMode && comparisonStats) {
    return (
      <button
        className={styles.comparisonInfoIcon}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        onClick={() => clearComparison()}
        aria-label="Comparison details. Click to clear comparison."
        title="Hover or focus for comparison details • Click to clear comparison"
      >
        <FaEye className={styles.infoIcon} />
        {showTooltip && (
          <div className={styles.comparisonTooltip} role="tooltip">
            <div className={styles.tooltipHeader}>
              Comparison: {comparisonStats.comparisonTabTitle} vs{" "}
              {comparisonStats.baseTabTitle}
            </div>
            {comparisonStats.isUpdating && (
              <div className={styles.updatingNotice}>
                Results are still streaming; comparison updates live.
              </div>
            )}
            {!comparisonStats.isReady && (
              <div className={styles.updatingNotice}>
                Waiting for comparison columns and result data.
              </div>
            )}
            <div className={styles.tooltipStats}>
              <div className={styles.statRow}>
                <strong>{comparisonStats.totalDifferences}</strong> differing
                cells across <strong>{comparisonStats.matchedRows}</strong>{" "}
                matched rows
              </div>
              <div className={styles.statRow}>
                <strong>{comparisonStats.addedRows}</strong> added and{" "}
                <strong>{comparisonStats.removedRows}</strong> removed rows
              </div>
              <div className={styles.statRow}>
                Duplicate key rows: base{" "}
                <strong>{comparisonStats.duplicateBaseRows}</strong>, comparison{" "}
                <strong>{comparisonStats.duplicateComparisonRows}</strong>
              </div>
              <div className={styles.statRow}>
                Rows with NULL or missing keys, excluded from added/removed:
                base <strong>{comparisonStats.unmatchableBaseRows}</strong>,
                comparison{" "}
                <strong>{comparisonStats.unmatchableComparisonRows}</strong>
              </div>
              <div className={styles.statRow}>
                <strong>{comparisonStats.matchingColumns}</strong> shared
                columns compared
              </div>
            </div>

            <div className={styles.tooltipSection}>
              <div className={styles.sectionTitle}>Highlight colors:</div>
              <div className={styles.colorLegend}>
                <span className={styles.legendItem}>
                  <span
                    className={`${styles.legendSwatch} ${styles.addedSwatch}`}
                  />
                  Added row
                </span>
                <span className={styles.legendItem}>
                  <span
                    className={`${styles.legendSwatch} ${styles.removedSwatch}`}
                  />
                  Removed row
                </span>
                <span className={styles.legendItem}>
                  <span
                    className={`${styles.legendSwatch} ${styles.differentSwatch}`}
                  />
                  Changed value
                </span>
                <span className={styles.legendItem}>
                  <span
                    className={`${styles.legendSwatch} ${styles.ambiguousSwatch}`}
                  />
                  Duplicate or unusable key
                </span>
              </div>
            </div>

            <div className={styles.tooltipSection}>
              <div className={styles.sectionTitle}>Matching key:</div>
              <div className={styles.columnList}>
                {selectedComparisonKeyColumns.join(", ")}
              </div>
            </div>

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

  return (
    <div className={styles.comparisonControls}>
      <button
        className={`${styles.controlButton} ${buttonConfig.className}`}
        onClick={handleButtonClick}
        disabled={!hasEnoughTabs}
        title={buttonConfig.title}
        aria-label={buttonConfig.title}
      >
        <IconComponent className={styles.icon} />
      </button>
      {showKeyPicker && (
        <div
          className={styles.keyPicker}
          role="dialog"
          aria-label="Choose comparison key columns"
        >
          <div className={styles.keyPickerTitle}>Match rows by</div>
          <p className={styles.keyPickerDescription}>
            Select one or more shared columns.
          </p>
          {commonColumns.length > 0 ? (
            <div className={styles.keyOptions}>
              {commonColumns.map((column, index) => (
                <label
                  className={styles.keyOption}
                  key={`${column.baseIndex}-${column.comparisonIndex}`}
                  htmlFor={`comparison-key-${currentTabId}-${index}`}
                >
                  <input
                    id={`comparison-key-${currentTabId}-${index}`}
                    type="checkbox"
                    checked={selectedKeyColumns.includes(column.columnName)}
                    onChange={(event) => {
                      setSelectedKeyColumns((selected) =>
                        event.target.checked
                          ? [...selected, column.columnName]
                          : selected.filter(
                              (name) => name !== column.columnName,
                            ),
                      );
                    }}
                  />
                  <span>{column.columnName}</span>
                  {column.columnName === suggestedKey && (
                    <span className={styles.suggestedLabel}>Suggested</span>
                  )}
                </label>
              ))}
            </div>
          ) : (
            <p className={styles.noKeysMessage}>
              No unambiguous shared columns are available to match these
              results.
            </p>
          )}
          <div className={styles.keyPickerActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => setShowKeyPicker(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.confirmButton}
              onClick={handleCompare}
              disabled={selectedKeyColumns.length === 0}
            >
              Compare
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonControls;
