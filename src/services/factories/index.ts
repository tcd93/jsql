export * from "./AbstractDatabaseFactory";
// Import factories to trigger their registration
import "./SqlServerFactory";
import "./PostgresFactory";
