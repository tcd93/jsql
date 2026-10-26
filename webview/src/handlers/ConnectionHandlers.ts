import { ConnectionChangedMessage } from "@src/types";
import { fetchSchema } from "../services/SchemaService";
import { useSchemaStore } from "../store/schemaStore";

export const handleConnectionChanged = (
  message: ConnectionChangedMessage
): void => {
  const { profile } = message.payload;
  const schemaStore = useSchemaStore.getState();
  if (!profile) {
    schemaStore.setLoading(false);
    schemaStore.clearSchema();
    schemaStore.setCurrentProfile(null);
    return;
  }
  fetchSchema();
  schemaStore.setCurrentProfile(profile);
};
