import * as vscode from "vscode";
import {
  BaseEditorProvider,
  CodeMirrorEditorProvider,
  DefaultEditorProvider,
  ResultPanelProvider,
} from "./providers/editors";
import {
  getService,
  initializeServices,
  MessageService,
  disposeServices,
} from "./services";

export function activate(context: vscode.ExtensionContext): void {
  console.debug("[Extension] Activating JSQL Extension...");
  const container = initializeServices(context);
  const messageService = container.get(MessageService);

  messageService.registerHandler("jSql.openEditor", async () => {
    await getService(BaseEditorProvider).openEditor();
  });
  messageService.registerHandler("jSql.chooseConnection", async () => {
    await getService(BaseEditorProvider).chooseConnection();
  });
  messageService.registerHandler("jSql.executeAllQueries", async () => {
    await getService(BaseEditorProvider).executeAllQueries();
  });
  messageService.registerHandler("jSql.executeQueryAtCursor", async () => {
    await getService(BaseEditorProvider).executeQueryAtCursor();
  });
  messageService.registerHandler("jSql.cancelAllQueries", async () => {
    getService(BaseEditorProvider).cancelAllQueries();
  });

  // Register commands
  const openEditorCommand = vscode.commands.registerCommand(
    "jSql.openEditor",
    () => {
      messageService.invoke({
        type: "jSql.openEditor",
        payload: void 0,
      });
    }
  );

  const chooseConnectionCommand = vscode.commands.registerCommand(
    "jSql.chooseConnection",
    () => {
      messageService.invoke({
        type: "jSql.chooseConnection",
        payload: void 0,
      });
    }
  );

  const executeQueryAtCursorCommand = vscode.commands.registerCommand(
    "jSql.executeQueryAtCursor",
    () => {
      messageService.invoke({
        type: "jSql.executeQueryAtCursor",
        payload: void 0,
      });
    }
  );

  // These commands are specific to webview-based custom editor
  const executeAllQueriesCommand = vscode.commands.registerCommand(
    "jSql.executeAllQueries",
    () => {
      messageService.invoke({
        type: "jSql.executeAllQueries",
        payload: void 0,
      });
    }
  );

  const cancelAllQueriesCommand = vscode.commands.registerCommand(
    "jSql.cancelAllQueries",
    () => {
      messageService.invoke({
        type: "jSql.cancelAllQueries",
        payload: void 0,
      });
    }
  );

  context.subscriptions.push(
    openEditorCommand,
    chooseConnectionCommand,
    executeAllQueriesCommand,
    executeQueryAtCursorCommand,
    cancelAllQueriesCommand
  );

  new ResultPanelProvider(context);
  container.register(BaseEditorProvider, (c) => {
    if (vscode.workspace.getConfiguration("jSql").get("useCodeMirror")) {
      return new CodeMirrorEditorProvider(c.context);
    }
    return new DefaultEditorProvider(c.context);
  });
}

export function deactivate(): void {
  disposeServices();
  console.debug("[Extension] JSQL Extension is now deactivated!");

  // Clean up language service if it exists
  // Note: In practice, VS Code handles disposal through subscriptions
}
