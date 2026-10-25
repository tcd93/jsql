import { useEffect } from "react";
import { Subscription, auditTime, merge } from "rxjs";
import { useComparisonResultStore } from "../store/comparisonResultStore";
import { getTabResultData, getTabResultRows } from "../store/tabResultDataStore";
import { TabData, useTabStore } from "../store/tabStore";
import { ComparisonAccumulator, mapColumns } from "../utils/comparisonUtils";

interface ComparisonConfiguration {
  baseTab: TabData;
  comparisonTab: TabData;
  keyColumnNames: string[];
}

const sameConfiguration = (
  left: ComparisonConfiguration | null,
  right: ComparisonConfiguration | null,
): boolean => {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.baseTab.id === right.baseTab.id &&
    left.comparisonTab.id === right.comparisonTab.id &&
    left.baseTab.schema === right.baseTab.schema &&
    left.comparisonTab.schema === right.comparisonTab.schema &&
    left.keyColumnNames.length === right.keyColumnNames.length &&
    left.keyColumnNames.every(
      (key, index) =>
        key.toLowerCase() === right.keyColumnNames[index].toLowerCase(),
    )
  );
};

export const useComparisonSync = (): void => {
  useEffect(() => {
    let configuration: ComparisonConfiguration | null = null;
    let dataSubscription: Subscription | undefined;

    const syncConfiguration = (): void => {
      const state = useTabStore.getState();
      const baseTab = state.tabs.find(
        (tab) => tab.id === state.selectedBaseTabId,
      );
      const comparisonTab = state.tabs.find(
        (tab) => tab.id === state.selectedComparisonTabId,
      );
      const nextConfiguration =
        baseTab &&
        comparisonTab &&
        baseTab.id !== comparisonTab.id &&
        state.selectedComparisonKeyColumns.length > 0
          ? {
              baseTab,
              comparisonTab,
              keyColumnNames: [...state.selectedComparisonKeyColumns],
            }
          : null;

      if (sameConfiguration(configuration, nextConfiguration)) {
        return;
      }

      dataSubscription?.unsubscribe();
      dataSubscription = undefined;
      configuration = nextConfiguration;

      if (!nextConfiguration) {
        useComparisonResultStore.setState({
          baseTabId: null,
          comparisonTabId: null,
          result: null,
        });
        return;
      }

      const { baseTab: base, comparisonTab: comparison, keyColumnNames } =
        nextConfiguration;
      const columnMappings = mapColumns(base.schema, comparison.schema);
      const matchingKeys = new Set(
        columnMappings.map((mapping) => mapping.columnName.toLowerCase()),
      );
      if (keyColumnNames.some((key) => !matchingKeys.has(key.toLowerCase()))) {
        useComparisonResultStore.setState({
          baseTabId: base.id,
          comparisonTabId: comparison.id,
          result: null,
        });
        return;
      }

      const baseData = getTabResultData(base.id);
      const comparisonData = getTabResultData(comparison.id);
      if (!baseData || !comparisonData) {
        useComparisonResultStore.setState({
          baseTabId: base.id,
          comparisonTabId: comparison.id,
          result: null,
        });
        return;
      }

      const accumulator = new ComparisonAccumulator(
        getTabResultRows(base.id),
        getTabResultRows(comparison.id),
        columnMappings,
        keyColumnNames,
      );
      const publishResult = (): void => {
        useComparisonResultStore.setState({
          baseTabId: base.id,
          comparisonTabId: comparison.id,
          result: accumulator.getSnapshot(),
        });
      };
      const updateResult = (): void => {
        if (accumulator.update()) {
          publishResult();
        }
      };

      dataSubscription = merge(
        baseData.batchedDataStream,
        comparisonData.batchedDataStream,
      )
        .pipe(auditTime(0))
        .subscribe(updateResult);

      publishResult();
    };

    const unsubscribe = useTabStore.subscribe(syncConfiguration);
    syncConfiguration();

    return (): void => {
      unsubscribe();
      dataSubscription?.unsubscribe();
      useComparisonResultStore.setState({
        baseTabId: null,
        comparisonTabId: null,
        result: null,
      });
    };
  }, []);
};
