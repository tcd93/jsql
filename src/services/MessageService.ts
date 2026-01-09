import * as vscode from "vscode";
import {
  ExtensionToExtensionMessageTypeMap,
  ExtensionToWebviewMessageTypeMap,
  WebviewToExtensionMessageTypeMap,
} from "../types";

type AllMessageTypeMap = WebviewToExtensionMessageTypeMap &
  ExtensionToWebviewMessageTypeMap &
  ExtensionToExtensionMessageTypeMap;

type MessageTypeKey = keyof AllMessageTypeMap;

type MessageType<K extends MessageTypeKey> = AllMessageTypeMap[K];

type AnyMessageHandler = (message: AllMessageTypeMap[MessageTypeKey]) => void;

class HandlerMap extends Map<MessageTypeKey, AnyMessageHandler[]> {
  addHandler<K extends MessageTypeKey>(
    type: K,
    handler: (message: MessageType<K>) => void
  ): this {
    const existingHandlers = this.get(type) ?? [];
    existingHandlers.push(handler as AnyMessageHandler);
    this.set(type, existingHandlers);
    return this;
  }

  getHandlers<K extends MessageTypeKey>(
    type: K
  ): ((message: MessageType<K>) => void)[] {
    return (this.get(type) ?? []) as ((message: MessageType<K>) => void)[];
  }

  removeHandler<K extends MessageTypeKey>(
    type: K,
    handler: (message: MessageType<K>) => void
  ): boolean {
    const handlers = this.get(type);
    if (!handlers) {
      return false;
    }

    const index = handlers.indexOf(handler as AnyMessageHandler);
    if (index === -1) {
      return false;
    }

    handlers.splice(index, 1);

    // If no handlers left, remove the key entirely
    if (handlers.length === 0) {
      this.delete(type);
    }

    return true;
  }
}

export class MessageService extends vscode.Disposable {
  private readonly handlers: HandlerMap = new HandlerMap();

  constructor() {
    super(() => this.dispose());
  }

  public dispose(): void {
    this.unregisterAllHandlers();
  }

  public registerHandler<K extends MessageTypeKey>(
    type: K,
    handler: (message: MessageType<K>) => void
  ): () => void {
    this.handlers.addHandler(type, handler);

    // Return unregister function
    return () => {
      this.unregisterHandler(type, handler);
    };
  }

  public unregisterHandler<K extends MessageTypeKey>(
    type: K,
    handler: (message: MessageType<K>) => void
  ): boolean {
    const removed = this.handlers.removeHandler(type, handler);
    if (removed) {
      console.debug(`Unregistered handler for message type: ${type}`);
    } else {
      console.warn(`Handler not found for message type: ${type}`);
    }
    return removed;
  }

  public invoke(message: MessageType<MessageTypeKey>): void {
    const handlers = this.handlers.getHandlers(message.type);
    if (handlers.length > 0) {
      handlers.forEach((handler, index) => {
        try {
          handler(message);
        } catch (error) {
          console.error(
            `Error in handler ${index} for message type ${message.type}:`,
            error
          );
        }
      });
    } else {
      console.warn(`No handlers registered for message type: ${message.type}`);
    }
  }

  public unregisterAllHandlers(): void {
    console.debug("Unregistering all message handlers");
    this.handlers.clear();
  }
}
