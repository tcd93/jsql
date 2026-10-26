export interface MssqlConnectionAuthMetadata {
  username?: string;
  tenantId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getMssqlConnectionAuthMetadata(
  connections: unknown,
  connectionId: string,
): MssqlConnectionAuthMetadata | undefined {
  if (!Array.isArray(connections)) {
    return undefined;
  }

  const matches = connections.filter(
    (connection) => isRecord(connection) && connection.id === connectionId,
  );
  if (matches.length !== 1) {
    return undefined;
  }

  const savedConnection = matches[0];
  if (!isRecord(savedConnection)) {
    return undefined;
  }

  const metadata: MssqlConnectionAuthMetadata = {
    username:
      nonEmptyString(savedConnection.email) ??
      nonEmptyString(savedConnection.user),
    tenantId: nonEmptyString(savedConnection.tenantId),
  };

  return metadata;
}
