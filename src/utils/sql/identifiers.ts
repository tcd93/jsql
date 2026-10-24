const SIMPLE_IDENTIFIER = /^[A-Za-z_#@][A-Za-z0-9_@$#]*$/;

export function quoteSqlServerIdentifier(identifier: string): string {
  if (SIMPLE_IDENTIFIER.test(identifier)) {
    return identifier;
  }

  return `[${identifier.replace(/]/g, "]]")}]`;
}

export function quoteSqlServerQualifiedIdentifier(identifier: string): string {
  return identifier.split(".").map(quoteSqlServerIdentifier).join(".");
}

export function quoteSqlServerColumnCompletion(label: string): string {
  const separator = label.lastIndexOf(".");
  if (separator === -1) {
    return quoteSqlServerIdentifier(label);
  }

  return `${label.slice(0, separator + 1)}${quoteSqlServerIdentifier(
    label.slice(separator + 1),
  )}`;
}
