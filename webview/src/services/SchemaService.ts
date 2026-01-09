import { GetSchemaDataMessage } from "@src/types";
import { useSchemaStore } from "../store/schemaStore";
import { getVSCodeAPI } from "../utils/vscode";

const vscode = getVSCodeAPI();

export const fetchSchema = (): void => {
  const { setError, setLoading } = useSchemaStore.getState();
  
  setError(null);
  setLoading(true);

  const message: GetSchemaDataMessage = {
    type: "wv.getSchemaData",
    payload: void 0,
  };

  vscode.postMessage(message);
};
