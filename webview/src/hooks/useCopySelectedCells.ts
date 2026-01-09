import { useCallback } from "react";
import { useSmartDrillStore } from "../store/smartDrillStore";

export const useCopySelectedCells = (): {
  copySelectedCells: () => Promise<void>;
  hasSelectedCells: boolean;
} => {
  // Only subscribe to the length to check if we have selections
  const hasSelectedCells = useSmartDrillStore(
    (state) => state.selectedCells.length > 0
  );

  const copySelectedCells = useCallback(async (): Promise<void> => {
    // Get fresh data when actually copying instead of subscribing
    const selectedCells = useSmartDrillStore.getState().selectedCells;

    if (selectedCells.length === 0) {
      console.warn("No cells selected to copy");
      return;
    }

    try {
      // Extract values from selected cells and format as comma-delimited string
      const values = selectedCells
        .map((cell) => {
          const value = cell.getValue();
          if (value === null || value === undefined) {
            return "";
          }
          const stringValue = String(value);
          return `'${stringValue}'`;
        })
        .join(", ");
      console.debug("Copying values to clipboard:", values);

      await navigator.clipboard.writeText(values);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  }, []);

  return { copySelectedCells, hasSelectedCells };
};
