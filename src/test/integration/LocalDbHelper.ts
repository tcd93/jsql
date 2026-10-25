import { CreateConnectionParams } from "../../types";

export class LocalDbHelper {
  static getLocalDbConnectionParams(
    connectionName: string,
    database = "master"
  ): CreateConnectionParams {
    return {
      connectionName,
      host: "(localdb)\\MSSQLLocalDB",
      port: 1433,
      database,
      authentication: "Integrated Security",
      trustServerCertificate: true,
      encrypt: false,
    };
  }
}
