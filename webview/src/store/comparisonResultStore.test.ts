// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useComparisonSync } from "../hooks/useComparisonSync";
import { useComparisonResultStore } from "./comparisonResultStore";
import { appendTabResultData } from "./tabResultDataStore";
import { useTabStore } from "./tabStore";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const baseTabId = "comparison-coordinator-base";
const comparisonTabId = "comparison-coordinator-comparison";
let root: Root | undefined;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = undefined;
  }
  useTabStore.getState().closeAllTabs();
  vi.useRealTimers();
});

describe("comparisonResultStore", () => {
  it("publishes one shared result and refreshes it from batched stream updates", async () => {
    vi.useFakeTimers();
    const tabStore = useTabStore.getState();
    tabStore.addTab("select base", "base-query", baseTabId);
    tabStore.addTab("select comparison", "comparison-query", comparisonTabId);
    const schema = [
      { name: "id", type: "int" },
      { name: "value", type: "nvarchar" },
    ];
    tabStore.updateTab(baseTabId, { schema });
    tabStore.updateTab(comparisonTabId, { schema });
    tabStore.setBaseTab(baseTabId);
    tabStore.compareWithSelectedTab(comparisonTabId, ["id"]);
    appendTabResultData(baseTabId, [
      [1, "same"],
      [2, "base"],
    ]);
    appendTabResultData(comparisonTabId, [
      [1, "same"],
      [2, "old"],
    ]);

    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root?.render(
        React.createElement(() => {
          useComparisonSync();
          return null;
        }),
      );
    });

    const initialResult = useComparisonResultStore.getState().result;
    expect(initialResult?.matchedRows).toBe(2);
    expect(initialResult?.differences.size).toBe(1);

    appendTabResultData(baseTabId, [[3, "new base"]]);
    appendTabResultData(comparisonTabId, [[3, "new comparison"]]);
    await vi.advanceTimersByTimeAsync(51);

    const updatedResult = useComparisonResultStore.getState().result;
    expect(updatedResult).not.toBe(initialResult);
    expect(updatedResult?.matchedRows).toBe(3);
    expect(updatedResult?.differences).toEqual(new Set(["1,1", "2,1"]));
  });
});
