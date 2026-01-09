import {
  SchemaDataFoundMessage,
  SchemaDataErrorMessage,
} from "@src/types";
import { useSchemaStore } from "../store/schemaStore";

export const handleSchemaDataFoundMessage = (
  message: SchemaDataFoundMessage
): void => {
  const { schemaData } = message.payload;
  useSchemaStore.getState().setSchemaData(schemaData);
};

export const handleSchemaDataErrorMessage = (
  message: SchemaDataErrorMessage
): void => {
  const { error } = message.payload;

  console.error("Schema data error:", error);
  useSchemaStore.getState().setError(error);
};
