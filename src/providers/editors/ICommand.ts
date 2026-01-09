import { ConnectionProfile } from "../../types";

/**
 * Interface for VSCode commands
 */
export interface IVscodeCommand {
    /*
    "jSql.openEditor"
    */
    openEditor(): void;
    /**
     * "jSql.chooseConnection"
     */
    chooseConnection(): void;
    /**
     * "jSql.executeAllQueries"
     */
    executeAllQueries(): void;
    
    /**
     * "jSql.executeQueryAtCursor"
     */
    executeQueryAtCursor(connectionProfile?: ConnectionProfile): void;
    /**
     * "jSql.cancelAllQueries"
     */
    cancelAllQueries(): void;
}