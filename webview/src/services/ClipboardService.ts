import { useSmartDrillStore } from "../store/smartDrillStore";

export const copySelectedCells = async (): Promise<void> => {
  const selectedCells = useSmartDrillStore.getState().selectedCells;

  if (selectedCells.size === 0) {
    console.warn("No cells selected to copy");
    return;
  }

  try {
    const cellsArray = Array.from(selectedCells.values());
    
    // If selected only one cell, copy its raw value directly
    if (cellsArray.length === 1) {
      const value = cellsArray[0].getValue();
      const stringValue =
        value === null || value === undefined ? "" : String(value);
      await navigator.clipboard.writeText(stringValue);
      return;
    }

    // Extract values from selected cells and format as comma-delimited string
    const values = cellsArray
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
