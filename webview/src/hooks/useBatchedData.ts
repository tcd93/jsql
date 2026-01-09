import { useState, useEffect, useMemo } from "react";
import { filter, scan, bufferTime } from "rxjs/operators";
import { useTabStore } from "../store/tabStore";

interface BatchConfig {
  batchSize: number;
  batchInterval: number;
  renderThreshold: number;
}

const DEFAULT_CONFIG: BatchConfig = {
  batchSize: 50,
  batchInterval: 50,
  renderThreshold: 10,
};

/**
 * Custom hook that processes incremental data updates using RxJS
 * Listens to tab store's incremental data stream for efficient batching
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
