import { ExtensionToWebviewMessageTypeMap } from "@src/types";
import { create } from "zustand";

type MessageTypeKey = keyof ExtensionToWebviewMessageTypeMap;

class HandlerMap extends Map {
  set<K extends MessageTypeKey>(
    type: K,
    handler: (message: ExtensionToWebviewMessageTypeMap[K]) => void
  ): this {
    super.set(type, handler);
    return this;
  }

  get<K extends MessageTypeKey>(
    type: K
  ): ((message: ExtensionToWebviewMessageTypeMap[K]) => void) | undefined {
    return super.get(type);
  }
}

export interface MessageHandlerState {
  isInitialized: boolean;
  initialize: () => () => void;

  _handlers: HandlerMap;

  registerHandler<const K extends MessageTypeKey>(
    type: K,
    handler: (message: ExtensionToWebviewMessageTypeMap[K]) => void
  ): void;

  unregisterHandler<const K extends MessageTypeKey>(type: K): void;
}

export const useMessageHandlerStore = create<MessageHandlerState>(
  (set, get) => ({
    isInitialized: false,

    _handlers: new HandlerMap(),

    initialize: () => {
      if (get().isInitialized) {
        return (): void => {
          // do nothing
        };
      }

      const handleMessage = (event: MessageEvent): void => {
        const msg =
          event.data as ExtensionToWebviewMessageTypeMap[MessageTypeKey];
        const handler = get()._handlers.get(msg.type);
        if (handler) {
          handler(msg);
        } else {
          console.warn("Unknown message:", msg);
        }
      };

      window.addEventListener("message", handleMessage);
      set({ isInitialized: true });

      return (): void => {
        window.removeEventListener("message", handleMessage);
        set({ isInitialized: false });
      };
    },

    registerHandler<const K extends MessageTypeKey>(
      type: K,
      handler: (message: ExtensionToWebviewMessageTypeMap[K]) => void
    ): void {
      get()._handlers.set(type, handler);
    },

    unregisterHandler<const K extends MessageTypeKey>(type: K): void {
      get()._handlers.delete(type);
    },
  })
);
