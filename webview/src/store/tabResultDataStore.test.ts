import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendTabResultData,
  createTabResultData,
  deleteTabResultData,
  getTabResultData,
} from "./tabResultDataStore";

const tabId = "result-data-store-test";

afterEach(() => {
  deleteTabResultData(tabId);
  vi.useRealTimers();
});

describe("tabResultDataStore", () => {
  it("appends rows without replacing the stored row array", () => {
    createTabResultData(tabId);
    const resultData = getTabResultData(tabId);
    const rows = resultData?.getRows();

    appendTabResultData(tabId, [[1], [2]]);
    appendTabResultData(tabId, [[3]]);

    expect(resultData?.getRows()).toBe(rows);
    expect(resultData?.getRows()).toEqual([[1], [2], [3]]);
  });

  it("removes the result source and completes its stream", () => {
    createTabResultData(tabId);
    const resultData = getTabResultData(tabId);
    const onComplete = vi.fn();
    resultData?.batchedDataStream.subscribe({ complete: onComplete });

    deleteTabResultData(tabId);

    expect(getTabResultData(tabId)).toBeUndefined();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("shares buffered row batches between subscribers", async () => {
    vi.useFakeTimers();
    createTabResultData(tabId);
    const resultData = getTabResultData(tabId);
    const firstSubscriber = vi.fn();
    const secondSubscriber = vi.fn();
    resultData?.batchedDataStream.subscribe(firstSubscriber);
    resultData?.batchedDataStream.subscribe(secondSubscriber);

    appendTabResultData(tabId, [[1]]);
    appendTabResultData(tabId, [[2]]);
    await vi.advanceTimersByTimeAsync(50);

    expect(firstSubscriber).toHaveBeenCalledOnce();
    expect(firstSubscriber).toHaveBeenCalledWith([[1], [2]]);
    expect(secondSubscriber.mock.calls[0][0]).toBe(
      firstSubscriber.mock.calls[0][0],
    );
  });
});
