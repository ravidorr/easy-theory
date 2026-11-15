import type { Row } from "./tables";

export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Row)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, sortKeys(entry)])
    );
  }
  return value;
}

export function rowIdentity(row: Row, key: readonly string[]): string {
  return JSON.stringify(key.map((column) => row[column] ?? null));
}

export function sortRows(rows: Row[], key: readonly string[]): Row[] {
  return rows
    .map((row) => sortKeys(row) as Row)
    .sort((a, b) => {
      const left = `${rowIdentity(a, key)}${JSON.stringify(a)}`;
      const right = `${rowIdentity(b, key)}${JSON.stringify(b)}`;
      return left < right ? -1 : left > right ? 1 : 0;
    });
}

export function serialize(rows: Row[]): string {
  return `${JSON.stringify(rows, null, 2)}\n`;
}
