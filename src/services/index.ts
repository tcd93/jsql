import * as vscode from "vscode";
import { ConnectionService } from "./connection";
import { ConnectionProfileService } from "./ConnectionProfileService";
import { MessageService } from "./MessageService";
import { MetadataCacheService } from "./MetadataCacheService";
import { MssqlExtensionService } from "./MssqlExtensionService";
import { OutputService } from "./OutputService";
import { QueryHighlightService } from "./QueryHighlightService";
import { QueryStateManager } from "./QueryStateManager";
import { StatusBarService } from "./StatusBarService";

export * from "./connection";
export * from "./factories";
export * from "./schema";
export * from "./StatusBarService";
export * from "./QueryStateManager";
export * from "./MessageService";
export * from "./OutputService";
export * from "./ConnectionWizard";
export * from "./MssqlExtensionService";
export * from "./ConnectionProfileService";
export * from "./MetadataCacheService";
export * from "./QueryHighlightService";

type ServiceFactory<T extends vscode.Disposable> = (
  container: ServiceContainer
) => T;
type ServiceClass<T extends vscode.Disposable> = abstract new (
  ...args: never[]
) => T;
type ServiceConstructor = abstract new (...args: never[]) => vscode.Disposable;

class ServiceContainer {
  private readonly services = new Map<ServiceConstructor, vscode.Disposable>();
  private readonly factories = new Map<
    ServiceConstructor,
    ServiceFactory<vscode.Disposable>
  >();

  constructor(public readonly context: vscode.ExtensionContext) {}

  register<T extends vscode.Disposable>(
    serviceClass: ServiceClass<T>,
    factory: ServiceFactory<T>
  ): void {
    this.factories.set(serviceClass, factory);
  }

  get<T extends vscode.Disposable>(serviceClass: ServiceClass<T>): T {
    const existingInstance = this.services.get(serviceClass);
    if (existingInstance) {
      return existingInstance as T;
    }

    const factory = this.factories.get(serviceClass);
    if (!factory) {
      throw new Error(`Service ${serviceClass.name} not registered`);
    }

    const instance = factory(this) as T;
    this.services.set(serviceClass, instance);
    this.context.subscriptions.push(instance);

    return instance;
  }

  dispose(): void {
    this.services.forEach(service => service.dispose());
    this.services.clear();
    console.debug("[ServiceContainer] Disposed all services");
  }
}

let container: ServiceContainer | undefined;

export function initializeServices(
  context: vscode.ExtensionContext
): ServiceContainer {
  container = new ServiceContainer(context);

  // Register all services with their factories
  container.register(MessageService, () => new MessageService());
  container.register(OutputService, () => new OutputService());
  container.register(MetadataCacheService, () => new MetadataCacheService());
  container.register(QueryHighlightService, () => new QueryHighlightService());
  container.register(MssqlExtensionService, () => new MssqlExtensionService());
  container.register(
    ConnectionProfileService,
    () => new ConnectionProfileService()
  );
  container.register(StatusBarService, () => new StatusBarService());
  container.register(QueryStateManager, () => new QueryStateManager());
  container.register(ConnectionService, () => new ConnectionService());

  // Initialize services that need to be created immediately
  container.get(MessageService);
  container.get(OutputService);
  container.get(MssqlExtensionService);
  container.get(MetadataCacheService);
  container.get(ConnectionProfileService);
  container.get(QueryHighlightService);
  container.get(StatusBarService);
  container.get(QueryStateManager);

  return container;
}

export function getContext(): vscode.ExtensionContext {
  if (!container) {
    throw new Error(
      "Services not initialized. Call initializeServices() first."
    );
  }
  return container.context;
}

export function getService<T extends vscode.Disposable>(
  serviceClass: ServiceClass<T>
): T {
  if (!container) {
    throw new Error(
      "Services not initialized. Call initializeServices() first."
    );
  }
  return container.get(serviceClass);
}

export function disposeServices(): void {
  if (!container) {
    return;
  }
  container.dispose();
}