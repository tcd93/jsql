import { SmartDrillTableRequest } from "@src/types";
import { generateSmartDrillQuery } from "../services/SmartDrillService";
import { useEditorStore } from "../store/editorStore";
import { useSmartDrillStore } from "../store/smartDrillStore";

export const handleSmartDrillTablesFound = (
  tables: SmartDrillTableRequest[]
): void => {
  const { setLoading, setSmartDrillOpen, setMatchedTables } =
    useSmartDrillStore.getState();

  if (tables.length === 0) {
    setLoading(false);
    setSmartDrillOpen(false);
    console.warn("No tables found containing all selected columns.");
    return;
  }

  if (tables.length === 1) {
    generateSmartDrillQuery(tables[0]);
  } else {
    setLoading(false);
    setSmartDrillOpen(true);
    setMatchedTables(tables);
  }
};

export const handleSmartDrillQueryGenerated = (query: string): void => {
  const { content, updateContent, setEditorContent } =
    useEditorStore.getState();
  const newContent = `${content}\n\n${query}`;
  updateContent(newContent);
  if (setEditorContent) {
    setEditorContent(newContent);
  } else {
    console.warn("setEditorContent is not yet defined in editor store");
  }

  const { setLoading, setSmartDrillOpen } = useSmartDrillStore.getState();
  setLoading(false);
  setSmartDrillOpen(false);
};

export const handleSmartDrillError = (error: string): void => {
  const { setLoading, setSmartDrillOpen } = useSmartDrillStore.getState();
  setLoading(false);
  setSmartDrillOpen(false);
  console.error("Smart Drill error:", error);
};
