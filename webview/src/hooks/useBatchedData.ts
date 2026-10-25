import { useState, useEffect, useMemo } from "react";
import { bufferTime, defer, filter, scan, startWith } from "rxjs";
import { getTabResultData } from "../store/tabResultDataStore";

interface BatchConfig {
  batchSize: number;
  batchInterval: number;
}

const DEFAULT_CONFIG: BatchConfig = {
  batchSize: 50,
  batchInterval: 50,
};

/**
 * React hook that subscribes to a tab's incremental data stream and exposes
 * the accumulated rows as React state.
 *
 * Incoming updates are buffered using RxJS to reduce render frequency:
 * - Collects incoming row batches for a configurable time window or batch size.
 * - Merges buffered updates into a single batch.
 * - Accumulates all received rows over time.
 * - Triggers React state updates only once per buffered batch instead of on
 *   every individual stream emission.
 *
 * This is intended for high-frequency data streams (e.g. streaming query
 * results) where batching significantly improves rendering performance.
 */
export const useBatchedData = (
  tabId: string,
  config: Partial<BatchConfig> = {},
): unknown[][] => {
  const [renderedData, setRenderedData] = useState<unknown[][]>(() => [
    ...(getTabResultData(tabId)?.getRows() ?? []),
  ]);

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const resultData = getTabResultData(tabId);

  // Create the incremental batched data processing stream
  const batchedData$ = useMemo(() => {
    if (!resultData) {
      return undefined;
    }

    return defer(() => {
      const initialRows = [...resultData.getRows()];
      return resultData.dataStream.pipe(
        bufferTime(finalConfig.batchInterval, null, finalConfig.batchSize),
        filter((batch: unknown[][][]) => batch.length > 0),
        scan(
          (acc: unknown[][], batch: unknown[][][]) => {
            const flattenedRows = batch.flat();
            return [...acc, ...flattenedRows];
          },
          [...initialRows],
        ),
        startWith(initialRows),
      );
    });
  }, [resultData, finalConfig.batchInterval, finalConfig.batchSize]);

  // Subscribe to the batched data stream
  useEffect(() => {
    const subscription = batchedData$?.subscribe((data) => {
      setRenderedData(data);
    });

    return (): void => {
      subscription?.unsubscribe();
    };
  }, [batchedData$, resultData]);

  return renderedData;
};
