import { useState, useEffect, useMemo } from "react";
import { filter, scan, bufferTime } from "rxjs/operators";
import { useTabStore } from "../store/tabStore";

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
  config: Partial<BatchConfig> = {}
): unknown[][] => {
  const [renderedData, setRenderedData] = useState<unknown[][]>(
    () => useTabStore.getState().getTab(tabId)?.data ?? []
  );

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const dataStream = useTabStore((state) => state.getTab(tabId)?.dataStream);

  // Create the incremental batched data processing stream
  const batchedData$ = useMemo(() => {
    return dataStream?.pipe(
      bufferTime(
        finalConfig.batchInterval, // Time window (50ms)
        null, // No buffer creation interval
        finalConfig.batchSize // Max buffer size (50 items)
      ),

      // Filter out empty buffers
      filter((batch: unknown[][][]) => batch.length > 0),

      // Flatten the batched newRows arrays and accumulate
      scan((acc: unknown[][], batch: unknown[][][]) => {
        const flattenedRows = batch.flat();
        return [...acc, ...flattenedRows];
      }, [] as unknown[][])
    );
  }, [dataStream, finalConfig.batchInterval, finalConfig.batchSize]);

  // Subscribe to the batched data stream
  useEffect(() => {
    const subscription = batchedData$?.subscribe((data) => {
      setRenderedData(data);
    });

    return (): void => {
      subscription?.unsubscribe();
    };
  }, [batchedData$]);

  return renderedData;
};
