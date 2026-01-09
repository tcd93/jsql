import { ConnectionChangedMessage } from "@src/types";
import { fetchSchema } from "../services/SchemaService";
import { useSchemaStore } from "../store/schemaStore";

export const handleConnectionChanged = (
  message: ConnectionChangedMessage
): void => {
  const { profile } = message.payload;
  fetchSchema();
  useSchemaStore.getState().setCurrentProfile(profile);
};
