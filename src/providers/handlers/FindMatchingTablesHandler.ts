import * as vscode from "vscode";
import {
  MessageService,
  ConnectionProfileService,
  OutputService,
  MetadataCacheService,
  getService,
} from "../../services";
import {
  SmartDrillErrorMessage,
  SmartDrillTablesFoundMessage,
} from "../../types";

export interface FindMatchingTablesHandler {
  findMatchingTables(
    uniqueColumnNames: string[],
    context: vscode.TextDocument
  ): Promise<void>;
}

export class FindMatchingTablesHandlerImpl
  implements FindMatchingTablesHandler
{
  private readonly profileService: ConnectionProfileService;
  private readonly messageService: MessageService;
  private readonly outputService: OutputService;
  private readonly metadataCacheService: MetadataCacheService;

  constructor(readonly context: vscode.ExtensionContext) {
    this.profileService = getService(ConnectionProfileService);
    this.messageService = getService(MessageService);
    this.outputService = getService(OutputService);
    this.metadataCacheService = getService(MetadataCacheService);
  }

  async findMatchingTables(
    uniqueColumnNames: string[],
    context: vscode.TextDocument
  ): Promise<void> {
    const profile = await this.profileService.getActiveConnection(context);
    if (!profile) {
      throw new Error("No active connection found");
    }

    try {
      if (uniqueColumnNames.length === 0) {
        throw new Error("No columns selected for smart drill");
      }

      if (this.metadataCacheService.hasCache(profile)) {
        const matchingTables = this.metadataCacheService.findMatchingTables(
          uniqueColumnNames,
          profile
        );

        const message: SmartDrillTablesFoundMessage = {
          type: "ext.smartDrillTablesFound",
          payload: {
            tables: matchingTables,
          },
        };
        this.messageService.invoke(message);
      } else {
        const message: SmartDrillTablesFoundMessage = {
          type: "ext.smartDrillTablesFound",
          payload: {
            tables: [],
          },
        };
        this.messageService.invoke(message);
        this.outputService.showWarning(
          "Metadata cache not available, please select a connection."
        );
      }
    } catch (error) {
      const errorMessage: SmartDrillErrorMessage = {
        type: "ext.smartDrillError",
        payload: {
          error: error instanceof Error ? error.message : "Smart drill failed",
        },
      };
      this.messageService.invoke(errorMessage);
      this.outputService.showError(
        error instanceof Error ? error.message : "Smart drill failed"
      );
    }
  }
}
