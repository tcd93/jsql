import { useState, useEffect, useMemo } from "react";
import { concat, defer, of, scan } from "rxjs";
import { getTabResultData } from "../store/tabResultDataStore";

/**
 * React hook that subscribes to a tab's incremental data stream and exposes
 * the accumulated rows as React state.
 *
 * The result store shares a single buffered stream per tab. This hook only
 * accumulates those batches for its consumer.
 * - Triggers React state updates only once per buffered batch instead of on
 *   every individual stream emission.
 */
export const useBatchedData = (tabId: string): unknown[][] => {
  const [renderedData, setRenderedData] = useState<unknown[][]>(() => [
    ...(getTabResultData(tabId)?.getRows() ?? []),
  ]);

  const resultData = getTabResultData(tabId);

  const batchedData$ = useMemo(() => {
    if (!resultData) {
      return undefined;
    }

    return defer(() => {
      const initialRows = [...resultData.getRows()];
      return concat(
        of(initialRows),
        resultData.batchedDataStream.pipe(
          scan(
            (acc: unknown[][], batch: unknown[][]) => [...acc, ...batch],
            [...initialRows],
          ),
        ),
      );
    });
  }, [resultData]);

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
