import { create } from "zustand";
import { ComparisonResult } from "../utils/comparisonUtils";

interface ComparisonResultState {
  baseTabId: string | null;
  comparisonTabId: string | null;
  result: ComparisonResult | null;
}

export const useComparisonResultStore = create<ComparisonResultState>(() => ({
  baseTabId: null,
  comparisonTabId: null,
  result: null,
}));
