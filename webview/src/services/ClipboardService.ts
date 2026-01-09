import { useSmartDrillStore } from "../store/smartDrillStore";

export const copySelectedCells = async (): Promise<void> => {
  const selectedCells = useSmartDrillStore.getState().selectedCells;

  if (selectedCells.length === 0) {
    console.warn("No cells selected to copy");
    return;
  }

  try {
    // If selected only one cell, copy its raw value directly
    if (selectedCells.length === 1) {
      const value = selectedCells[0].getValue();
      const stringValue =
        value === null || value === undefined ? "" : String(value);
      await navigator.clipboard.writeText(stringValue);
      return;
    }

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

    await navigator.clipboard.writeText(values);
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
  }
};
