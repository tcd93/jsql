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
});

describe("tabResultDataStore", () => {
  it("appends rows without replacing the stored row array", () => {
    createTabResultData(tabId);
    const resultData = getTabResultData(tabId);
    const rows = resultData?.getRows();
    const onRows = vi.fn();
    resultData?.dataStream.subscribe(onRows);

    appendTabResultData(tabId, [[1], [2]]);
    appendTabResultData(tabId, [[3]]);

    expect(resultData?.getRows()).toBe(rows);
    expect(resultData?.getRows()).toEqual([[1], [2], [3]]);
    expect(onRows).toHaveBeenNthCalledWith(1, [[1], [2]]);
    expect(onRows).toHaveBeenNthCalledWith(2, [[3]]);
  });

  it("removes the result source and completes its stream", () => {
    createTabResultData(tabId);
    const resultData = getTabResultData(tabId);
    const onComplete = vi.fn();
    resultData?.dataStream.subscribe({ complete: onComplete });

    deleteTabResultData(tabId);

    expect(getTabResultData(tabId)).toBeUndefined();
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
