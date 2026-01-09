import { SchemaData, ConnectionProfile } from "@src/types";
import { create } from "zustand";

interface SchemaStore {
  schemaData: SchemaData;
  currentProfile: ConnectionProfile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setLoading: (loading: boolean) => void;
  setSchemaData: (data: SchemaData) => void;
  setCurrentProfile: (profile: ConnectionProfile | null) => void;
  setError: (error: string | null) => void;
  clearSchema: () => void;
}

export const useSchemaStore = create<SchemaStore>((set, get) => ({
  schemaData: {},
  isLoading: false,
  error: null,
  currentProfile: null,

  setLoading: (loading): void => set({ isLoading: loading }),

  setSchemaData: (data): void => {
    set({
      schemaData: {
        ...get().schemaData,
        ...data,
      },
      isLoading: false,
      error: null,
    });
  },

  setCurrentProfile: (profile): void => {
    set({
      currentProfile: profile,
    });
  },

  setError: (error): void =>
    set({
      error,
      isLoading: false,
    }),

  clearSchema: (): void =>
    set({
      schemaData: {},
      error: null,
    }),
}));
