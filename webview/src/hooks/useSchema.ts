import {
  SchemaDataFoundMessage,
  SchemaDataErrorMessage,
  GetSchemaDataMessage,
} from "@src/types";
import { useCallback } from "react";
import { useSchemaStore } from "../store/schemaStore";
import { getVSCodeAPI } from "../utils/vscode";

export interface UseSchemaProps {
  fetchSchema: () => void;
  handleSchemaDataFoundMessage: (message: SchemaDataFoundMessage) => void;
  handleSchemaDataErrorMessage: (message: SchemaDataErrorMessage) => void;
}

export const useSchema = (): UseSchemaProps => {
  const vscode = getVSCodeAPI();
  const setLoading = useSchemaStore((state) => state.setLoading);
  const setSchemaData = useSchemaStore((state) => state.setSchemaData);
  const setError = useSchemaStore((state) => state.setError);

  // fetch schemata of active connection
  const fetchSchema = useCallback(
    (): void => {
      setError(null);
      setLoading(true);

      const message: GetSchemaDataMessage = {
        type: "wv.getSchemaData",
        payload: void 0,
      };

      vscode.postMessage(message);
    },
    [vscode, setLoading, setError]
  );

  const handleSchemaDataFoundMessage = useCallback(
    (message: SchemaDataFoundMessage): void => {
      const { schemaData } = message.payload;
      setSchemaData(schemaData);
    },
    [setSchemaData]
  );

  const handleSchemaDataErrorMessage = useCallback(
    (message: SchemaDataErrorMessage): void => {
      const { error } = message.payload;

      console.error("Schema data error:", error);
      setError(error);
    },
    [setError]
  );

  return {
    fetchSchema,
    handleSchemaDataFoundMessage,
    handleSchemaDataErrorMessage,
  };
};
