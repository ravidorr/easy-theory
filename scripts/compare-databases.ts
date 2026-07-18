import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

type JsonObject = Record<string, unknown>;
type Fetch = typeof fetch;

export type DatabaseConfig = {
  label: "production" | "QA";
  url: string;
  serviceRoleKey: string;
};

export type ValueChange = {
  path: string;
  production: unknown;
  qa: unknown;
};

export type SchemaComparison = {
  productionOnlyTables: string[];
  qaOnlyTables: string[];
  changedTables: Record<string, ValueChange[]>;
  productionOnlyRpcs: string[];
  qaOnlyRpcs: string[];
  changedRpcs: Record<string, ValueChange[]>;
};

export type ReferenceTableComparison = {
  table: string;
  productionCount?: number;
  qaCount?: number;
  productionOnlyKeys: string[];
  qaOnlyKeys: string[];
  changedRows: Array<{ key: string; columns: string[] }>;
  changedColumnCounts: Record<string, number>;
  skipped?: string;
};

export type ComparisonReport = {
  schema: SchemaComparison;
  referenceData: ReferenceTableComparison[];
  hasDrift: boolean;
};

const PAGE_SIZE = 1_000;
const EXAMPLE_LIMIT = 10;
const PROPERTY_FIELDS = [
  "type",
  "format",
  "default",
  "maxLength",
  "enum",
  "nullable",
  "items",
  "$ref",
] as const;

const REFERENCE_TABLES = ["topics", "questions", "signs", "videos", "resources"] as const;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortedRecord<T>(entries: Array<[string, T]>): Record<string, T> {
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (!isObject(value)) return value;
  return sortedRecord(
    Object.entries(value).map(([key, nested]) => [key, normalizeJson(nested)])
  );
}

function normalizeProperty(value: unknown): JsonObject {
  if (!isObject(value)) return {};
  const entries: Array<[string, unknown]> = [];
  for (const field of PROPERTY_FIELDS) {
    if (field in value) entries.push([field, normalizeJson(value[field])]);
  }
  return sortedRecord(entries);
}

function normalizeDefinition(value: unknown): JsonObject {
  if (!isObject(value)) return {};
  const properties = isObject(value.properties) ? value.properties : {};
  const required = Array.isArray(value.required)
    ? [...value.required].map(String).sort()
    : [];
  return {
    required,
    properties: sortedRecord(
      Object.entries(properties).map(([name, property]) => [name, normalizeProperty(property)])
    ),
  };
}

function normalizeParameter(value: unknown): JsonObject {
  if (!isObject(value)) return {};
  const result: JsonObject = {};
  for (const field of ["name", "in", "required", "type", "format", "schema", "items"] as const) {
    if (field in value) result[field] = normalizeJson(value[field]);
  }
  return result;
}

function normalizeRpcOperation(value: unknown): JsonObject {
  if (!isObject(value)) return {};
  const parameters = Array.isArray(value.parameters)
    ? value.parameters.map(normalizeParameter).sort((left, right) => {
        const leftKey = `${String(left.in)}:${String(left.name)}`;
        const rightKey = `${String(right.in)}:${String(right.name)}`;
        return leftKey.localeCompare(rightKey);
      })
    : [];
  const responses = isObject(value.responses)
    ? sortedRecord(
        Object.entries(value.responses).map(([status, response]) => {
          const schema = isObject(response) && "schema" in response ? response.schema : null;
          return [status, normalizeJson(schema)];
        })
      )
    : {};
  return { parameters, responses };
}

function definitionsFromOpenApi(openApi: unknown): Record<string, JsonObject> {
  if (!isObject(openApi)) throw new Error("OpenAPI response is not an object");
  const definitions = isObject(openApi.definitions)
    ? openApi.definitions
    : isObject(openApi.components) && isObject(openApi.components.schemas)
      ? openApi.components.schemas
      : null;
  if (!definitions) throw new Error("OpenAPI response has no schema definitions");
  return sortedRecord(
    Object.entries(definitions).map(([name, definition]) => [name, normalizeDefinition(definition)])
  );
}

function rpcsFromOpenApi(openApi: unknown): Record<string, JsonObject> {
  if (!isObject(openApi) || !isObject(openApi.paths)) {
    throw new Error("OpenAPI response has no paths");
  }
  const entries: Array<[string, JsonObject]> = [];
  for (const [path, pathValue] of Object.entries(openApi.paths)) {
    if (!path.startsWith("/rpc/") || !isObject(pathValue)) continue;
    const operations: Array<[string, JsonObject]> = [];
    for (const method of ["get", "post"] as const) {
      if (method in pathValue) operations.push([method, normalizeRpcOperation(pathValue[method])]);
    }
    entries.push([path.slice("/rpc/".length), sortedRecord(operations)]);
  }
  return sortedRecord(entries);
}

function compareValues(production: unknown, qa: unknown, path = ""): ValueChange[] {
  if (Object.is(production, qa)) return [];
  if (Array.isArray(production) || Array.isArray(qa)) {
    return JSON.stringify(production) === JSON.stringify(qa)
      ? []
      : [{ path, production, qa }];
  }
  if (isObject(production) && isObject(qa)) {
    const changes: ValueChange[] = [];
    const keys = [...new Set([...Object.keys(production), ...Object.keys(qa)])].sort();
    for (const key of keys) {
      changes.push(
        ...compareValues(production[key], qa[key], path ? `${path}.${key}` : key)
      );
    }
    return changes;
  }
  return [{ path, production, qa }];
}

function compareNamedObjects(
  production: Record<string, JsonObject>,
  qa: Record<string, JsonObject>
): {
  productionOnly: string[];
  qaOnly: string[];
  changed: Record<string, ValueChange[]>;
} {
  const productionNames = Object.keys(production);
  const qaNames = Object.keys(qa);
  const productionOnly = productionNames.filter((name) => !(name in qa)).sort();
  const qaOnly = qaNames.filter((name) => !(name in production)).sort();
  const changedEntries: Array<[string, ValueChange[]]> = [];
  for (const name of productionNames.filter((candidate) => candidate in qa).sort()) {
    const changes = compareValues(production[name], qa[name]);
    if (changes.length > 0) changedEntries.push([name, changes]);
  }
  return { productionOnly, qaOnly, changed: sortedRecord(changedEntries) };
}

export function compareOpenApi(production: unknown, qa: unknown): SchemaComparison {
  const tables = compareNamedObjects(
    definitionsFromOpenApi(production),
    definitionsFromOpenApi(qa)
  );
  const rpcs = compareNamedObjects(rpcsFromOpenApi(production), rpcsFromOpenApi(qa));
  return {
    productionOnlyTables: tables.productionOnly,
    qaOnlyTables: tables.qaOnly,
    changedTables: tables.changed,
    productionOnlyRpcs: rpcs.productionOnly,
    qaOnlyRpcs: rpcs.qaOnly,
    changedRpcs: rpcs.changed,
  };
}

export function parseEnv(contents: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice("export ".length).trim();
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}

export function configFromEnv(
  values: Record<string, string>,
  label: DatabaseConfig["label"]
): DatabaseConfig {
  const url = values.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const serviceRoleKey = values.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      `${label} configuration must define NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`
    );
  }
  try {
    new URL(url);
  } catch {
    throw new Error(`${label} NEXT_PUBLIC_SUPABASE_URL is invalid`);
  }
  if (label === "QA" && values.QA_ENV !== "1") {
    throw new Error("QA configuration must define QA_ENV=1");
  }
  return { label, url, serviceRoleKey };
}

export function validateDistinctProjects(
  production: DatabaseConfig,
  qa: DatabaseConfig
): void {
  if (production.url === qa.url) {
    throw new Error("production and QA configurations point at the same Supabase project");
  }
}

export function loadConfigs(
  productionPath = ".env.local",
  qaPath = ".env.qa"
): { production: DatabaseConfig; qa: DatabaseConfig } {
  const ciVariableNames = [
    "PROD_SUPABASE_URL",
    "PROD_SUPABASE_SERVICE_ROLE_KEY",
    "QA_SUPABASE_URL",
    "QA_SUPABASE_SERVICE_ROLE_KEY",
  ] as const;
  if (ciVariableNames.some((name) => process.env[name])) {
    const missing = ciVariableNames.filter((name) => !process.env[name]);
    if (missing.length > 0) {
      throw new Error(`database audit environment is missing ${missing.join(", ")}`);
    }
    const production = configFromEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: process.env.PROD_SUPABASE_URL!,
        SUPABASE_SERVICE_ROLE_KEY: process.env.PROD_SUPABASE_SERVICE_ROLE_KEY!,
      },
      "production"
    );
    const qa = configFromEnv(
      {
        QA_ENV: "1",
        NEXT_PUBLIC_SUPABASE_URL: process.env.QA_SUPABASE_URL!,
        SUPABASE_SERVICE_ROLE_KEY: process.env.QA_SUPABASE_SERVICE_ROLE_KEY!,
      },
      "QA"
    );
    validateDistinctProjects(production, qa);
    return { production, qa };
  }
  let productionValues: Record<string, string>;
  let qaValues: Record<string, string>;
  try {
    productionValues = parseEnv(readFileSync(productionPath, "utf8"));
  } catch {
    throw new Error(`could not read production configuration from ${productionPath}`);
  }
  try {
    qaValues = parseEnv(readFileSync(qaPath, "utf8"));
  } catch {
    throw new Error(`could not read QA configuration from ${qaPath}`);
  }
  const production = configFromEnv(productionValues, "production");
  const qa = configFromEnv(qaValues, "QA");
  validateDistinctProjects(production, qa);
  return { production, qa };
}

function requestHeaders(config: DatabaseConfig): Record<string, string> {
  return {
    Accept: "application/json",
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
  };
}

async function fetchOpenApi(config: DatabaseConfig, fetchImpl: Fetch): Promise<unknown> {
  const response = await fetchImpl(`${config.url}/rest/v1/`, {
    method: "GET",
    headers: { ...requestHeaders(config), Accept: "application/openapi+json" },
  });
  if (!response.ok) {
    throw new Error(`${config.label} OpenAPI request failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchAllRows(
  config: DatabaseConfig,
  table: string,
  fetchImpl: Fetch = fetch
): Promise<JsonObject[]> {
  const rows: JsonObject[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const response = await fetchImpl(
      `${config.url}/rest/v1/${encodeURIComponent(table)}?select=*`,
      {
        method: "GET",
        headers: {
          ...requestHeaders(config),
          Range: `${start}-${start + PAGE_SIZE - 1}`,
        },
      }
    );
    if (!response.ok) {
      throw new Error(`${config.label} ${table} request failed with HTTP ${response.status}`);
    }
    const page: unknown = await response.json();
    if (!Array.isArray(page) || page.some((row) => !isObject(row))) {
      throw new Error(`${config.label} ${table} returned an invalid row set`);
    }
    rows.push(...(page as JsonObject[]));
    if (page.length < PAGE_SIZE) return rows;
  }
}

function omit(row: JsonObject, fields: string[]): JsonObject {
  return Object.fromEntries(Object.entries(row).filter(([field]) => !fields.includes(field)));
}

function normalizeReferenceRows(
  table: (typeof REFERENCE_TABLES)[number],
  rows: JsonObject[],
  topicSlugs: Map<string, string>
): JsonObject[] {
  if (table === "questions") {
    return rows.map((row) => ({
      ...omit(row, ["id", "topic_id"]),
      topic_slug:
        typeof row.topic_id === "string" ? (topicSlugs.get(row.topic_id) ?? null) : null,
    }));
  }
  return rows.map((row) => omit(row, ["id"]));
}

function referenceKey(table: (typeof REFERENCE_TABLES)[number], row: JsonObject): string {
  const field = {
    topics: "slug",
    questions: "question_number",
    signs: "sign_number",
    videos: "youtube_id",
    resources: "href",
  }[table];
  const value = row[field];
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${table} row has no usable ${field}`);
  }
  return String(value);
}

function rowsByKey(
  table: (typeof REFERENCE_TABLES)[number],
  rows: JsonObject[]
): Map<string, JsonObject> {
  const result = new Map<string, JsonObject>();
  for (const row of rows) {
    const key = referenceKey(table, row);
    if (result.has(key)) throw new Error(`${table} contains duplicate reference key ${key}`);
    result.set(key, row);
  }
  return result;
}

export function compareReferenceRows(
  table: (typeof REFERENCE_TABLES)[number],
  productionRows: JsonObject[],
  qaRows: JsonObject[]
): ReferenceTableComparison {
  const production = rowsByKey(table, productionRows);
  const qa = rowsByKey(table, qaRows);
  const productionOnlyKeys = [...production.keys()].filter((key) => !qa.has(key)).sort();
  const qaOnlyKeys = [...qa.keys()].filter((key) => !production.has(key)).sort();
  const changedRows: Array<{ key: string; columns: string[] }> = [];
  const changedColumnCounts: Record<string, number> = {};
  for (const key of [...production.keys()].filter((candidate) => qa.has(candidate)).sort()) {
    const changes = compareValues(production.get(key), qa.get(key));
    if (changes.length === 0) continue;
    const columns = changes.map((change) => change.path).sort();
    changedRows.push({ key, columns });
    for (const column of columns) {
      changedColumnCounts[column] = (changedColumnCounts[column] ?? 0) + 1;
    }
  }
  return {
    table,
    productionCount: productionRows.length,
    qaCount: qaRows.length,
    productionOnlyKeys,
    qaOnlyKeys,
    changedRows,
    changedColumnCounts: sortedRecord(Object.entries(changedColumnCounts)),
  };
}

function schemaHasDrift(schema: SchemaComparison): boolean {
  return (
    schema.productionOnlyTables.length > 0 ||
    schema.qaOnlyTables.length > 0 ||
    Object.keys(schema.changedTables).length > 0 ||
    schema.productionOnlyRpcs.length > 0 ||
    schema.qaOnlyRpcs.length > 0 ||
    Object.keys(schema.changedRpcs).length > 0
  );
}

function referenceHasDrift(comparison: ReferenceTableComparison): boolean {
  return (
    comparison.productionOnlyKeys.length > 0 ||
    comparison.qaOnlyKeys.length > 0 ||
    comparison.changedRows.length > 0 ||
    Boolean(comparison.skipped)
  );
}

export async function compareDatabases(
  production: DatabaseConfig,
  qa: DatabaseConfig,
  fetchImpl: Fetch = fetch
): Promise<ComparisonReport> {
  validateDistinctProjects(production, qa);
  const [productionOpenApi, qaOpenApi] = await Promise.all([
    fetchOpenApi(production, fetchImpl),
    fetchOpenApi(qa, fetchImpl),
  ]);
  const schema = compareOpenApi(productionOpenApi, qaOpenApi);
  const productionDefinitions = definitionsFromOpenApi(productionOpenApi);
  const qaDefinitions = definitionsFromOpenApi(qaOpenApi);
  const sharedReferenceTables = REFERENCE_TABLES.filter(
    (table) => table in productionDefinitions && table in qaDefinitions
  );
  const rowPairs = await Promise.all(
    sharedReferenceTables.map(async (table) => {
      const [productionRows, qaRows] = await Promise.all([
        fetchAllRows(production, table, fetchImpl),
        fetchAllRows(qa, table, fetchImpl),
      ]);
      return [table, productionRows, qaRows] as const;
    })
  );
  const productionRows = new Map(rowPairs.map(([table, rows]) => [table, rows]));
  const qaRows = new Map(rowPairs.map(([table, , rows]) => [table, rows]));
  const productionTopicSlugs = new Map(
    (productionRows.get("topics") ?? []).flatMap((row) =>
      typeof row.id === "string" && typeof row.slug === "string" ? [[row.id, row.slug]] : []
    )
  );
  const qaTopicSlugs = new Map(
    (qaRows.get("topics") ?? []).flatMap((row) =>
      typeof row.id === "string" && typeof row.slug === "string" ? [[row.id, row.slug]] : []
    )
  );

  const referenceData = REFERENCE_TABLES.map((table): ReferenceTableComparison => {
    if (!(table in productionDefinitions) || !(table in qaDefinitions)) {
      const missing = [
        ...(table in productionDefinitions ? [] : ["production"]),
        ...(table in qaDefinitions ? [] : ["QA"]),
      ];
      return {
        table,
        productionOnlyKeys: [],
        qaOnlyKeys: [],
        changedRows: [],
        changedColumnCounts: {},
        skipped: `not exposed in ${missing.join(" and ")}`,
      };
    }
    const normalizedProduction = normalizeReferenceRows(
      table,
      productionRows.get(table) ?? [],
      productionTopicSlugs
    );
    const normalizedQa = normalizeReferenceRows(
      table,
      qaRows.get(table) ?? [],
      qaTopicSlugs
    );
    return compareReferenceRows(table, normalizedProduction, normalizedQa);
  });

  return {
    schema,
    referenceData,
    hasDrift: schemaHasDrift(schema) || referenceData.some(referenceHasDrift),
  };
}

function displayPath(path: string): string {
  return path.replace(/^properties\./, "");
}

function displayValue(value: unknown): string {
  if (value === undefined) return "missing";
  const serialized = JSON.stringify(value);
  return serialized === undefined ? String(value) : serialized;
}

function listOrNone(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function renderChangedObjects(label: string, changed: Record<string, ValueChange[]>): string[] {
  const lines: string[] = [];
  for (const [name, changes] of Object.entries(changed)) {
    lines.push(`  ${label} ${name}:`);
    for (const change of changes.slice(0, EXAMPLE_LIMIT)) {
      lines.push(
        `    ${displayPath(change.path)}: production=${displayValue(change.production)}, QA=${displayValue(change.qa)}`
      );
    }
    if (changes.length > EXAMPLE_LIMIT) {
      lines.push(`    ... ${changes.length - EXAMPLE_LIMIT} more differences`);
    }
  }
  return lines;
}

export function renderReport(report: ComparisonReport): string {
  const lines = ["Database alignment: " + (report.hasDrift ? "DRIFT FOUND" : "ALIGNED"), "", "Schema"];
  lines.push(`  tables only in production: ${listOrNone(report.schema.productionOnlyTables)}`);
  lines.push(`  tables only in QA: ${listOrNone(report.schema.qaOnlyTables)}`);
  lines.push(...renderChangedObjects("table", report.schema.changedTables));
  lines.push(`  RPCs only in production: ${listOrNone(report.schema.productionOnlyRpcs)}`);
  lines.push(`  RPCs only in QA: ${listOrNone(report.schema.qaOnlyRpcs)}`);
  lines.push(...renderChangedObjects("RPC", report.schema.changedRpcs));
  lines.push("", "Reference data");
  for (const comparison of report.referenceData) {
    if (comparison.skipped) {
      lines.push(`  ${comparison.table}: skipped (${comparison.skipped})`);
      continue;
    }
    lines.push(
      `  ${comparison.table}: production=${comparison.productionCount}, QA=${comparison.qaCount}, ` +
        `production-only=${comparison.productionOnlyKeys.length}, QA-only=${comparison.qaOnlyKeys.length}, ` +
        `changed=${comparison.changedRows.length}`
    );
    const columnSummary = Object.entries(comparison.changedColumnCounts)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([column, count]) => `${column} (${count})`);
    if (columnSummary.length > 0) lines.push(`    changed columns: ${columnSummary.join(", ")}`);
    const examples = [
      ...comparison.productionOnlyKeys.map((key) => `${key} [production only]`),
      ...comparison.qaOnlyKeys.map((key) => `${key} [QA only]`),
      ...comparison.changedRows.map(({ key, columns }) => `${key} [${columns.join(", ")}]`),
    ];
    if (examples.length > 0) {
      lines.push(`    examples: ${examples.slice(0, EXAMPLE_LIMIT).join("; ")}`);
      if (examples.length > EXAMPLE_LIMIT) {
        lines.push(`    ... ${examples.length - EXAMPLE_LIMIT} more rows`);
      }
    }
  }
  lines.push(
    "",
    "Scope: PostgREST-visible schema and shared reference data only. User rows, indexes, triggers, grants, constraints, and RLS policy definitions are not compared."
  );
  return lines.join("\n");
}

export async function main(): Promise<void> {
  try {
    const { production, qa } = loadConfigs();
    const report = await compareDatabases(production, qa);
    console.log(renderReport(report));
    process.exitCode = report.hasDrift ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`db:compare - ${message}`);
    process.exitCode = 2;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main();
}
