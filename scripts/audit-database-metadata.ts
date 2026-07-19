import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

const MIGRATIONS_DIRECTORY = "seeds/migrations";
const EXAMPLE_LIMIT = 10;

export type AuditConfig = {
  label: "production" | "QA";
  databaseUrl: string;
};

export type CatalogCategory =
  | "tables"
  | "columns"
  | "constraints"
  | "indexes"
  | "policies"
  | "triggers"
  | "functions"
  | "tableGrants"
  | "functionGrants";

export type CatalogSnapshot = Record<CatalogCategory, Record<string, unknown>[]>;

export type MigrationFile = {
  version: number;
  filename: string;
  checksum: string;
};

export type MigrationLedgerEntry = MigrationFile & {
  appliedAt: string;
};

export type CategoryDifference = {
  productionOnly: string[];
  qaOnly: string[];
};

export type CatalogReport = {
  differences: Record<CatalogCategory, CategoryDifference>;
  hasDrift: boolean;
};

export type LedgerReport = {
  production: CategoryDifference;
  qa: CategoryDifference;
  hasDrift: boolean;
};

export class AuditConfigurationError extends Error {}

const CATEGORIES: CatalogCategory[] = [
  "tables",
  "columns",
  "constraints",
  "indexes",
  "policies",
  "triggers",
  "functions",
  "tableGrants",
  "functionGrants",
];

const CATALOG_QUERY = `
  SELECT jsonb_build_object(
    'tables', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', table_info.relname,
        'rls', table_info.relrowsecurity,
        'forceRls', table_info.relforcerowsecurity
      ) ORDER BY table_info.relname)
      FROM pg_class AS table_info
      JOIN pg_namespace AS namespace ON namespace.oid = table_info.relnamespace
      WHERE namespace.nspname = 'public'
        AND table_info.relkind IN ('r', 'p')
    ), '[]'::jsonb),
    'columns', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'table', table_info.relname,
        'name', attribute.attname,
        'position', attribute.attnum,
        'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
        'notNull', attribute.attnotnull,
        'default', pg_get_expr(default_value.adbin, default_value.adrelid),
        'identity', attribute.attidentity,
        'generated', attribute.attgenerated
      ) ORDER BY table_info.relname, attribute.attnum)
      FROM pg_class AS table_info
      JOIN pg_namespace AS namespace ON namespace.oid = table_info.relnamespace
      JOIN pg_attribute AS attribute ON attribute.attrelid = table_info.oid
      LEFT JOIN pg_attrdef AS default_value
        ON default_value.adrelid = table_info.oid AND default_value.adnum = attribute.attnum
      WHERE namespace.nspname = 'public'
        AND table_info.relkind IN ('r', 'p')
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    ), '[]'::jsonb),
    'constraints', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'table', table_info.relname,
        'name', constraint_info.conname,
        'type', constraint_info.contype,
        'definition', pg_get_constraintdef(constraint_info.oid, true),
        'validated', constraint_info.convalidated,
        'deferrable', constraint_info.condeferrable,
        'initiallyDeferred', constraint_info.condeferred
      ) ORDER BY table_info.relname, constraint_info.conname)
      FROM pg_constraint AS constraint_info
      JOIN pg_class AS table_info ON table_info.oid = constraint_info.conrelid
      JOIN pg_namespace AS namespace ON namespace.oid = table_info.relnamespace
      WHERE namespace.nspname = 'public'
    ), '[]'::jsonb),
    'indexes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'table', table_info.relname,
        'name', index_info.relname,
        'definition', pg_get_indexdef(index_info.oid)
      ) ORDER BY table_info.relname, index_info.relname)
      FROM pg_index AS index_relation
      JOIN pg_class AS table_info ON table_info.oid = index_relation.indrelid
      JOIN pg_namespace AS namespace ON namespace.oid = table_info.relnamespace
      JOIN pg_class AS index_info ON index_info.oid = index_relation.indexrelid
      WHERE namespace.nspname = 'public'
    ), '[]'::jsonb),
    'policies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'table', policy_info.tablename,
        'name', policy_info.policyname,
        'permissive', policy_info.permissive,
        'roles', policy_info.roles,
        'command', policy_info.cmd,
        'using', policy_info.qual,
        'withCheck', policy_info.with_check
      ) ORDER BY policy_info.tablename, policy_info.policyname)
      FROM pg_policies AS policy_info
      WHERE policy_info.schemaname = 'public'
    ), '[]'::jsonb),
    'triggers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'table', table_info.relname,
        'name', trigger_info.tgname,
        'enabled', trigger_info.tgenabled,
        'definition', pg_get_triggerdef(trigger_info.oid, true)
      ) ORDER BY table_info.relname, trigger_info.tgname)
      FROM pg_trigger AS trigger_info
      JOIN pg_class AS table_info ON table_info.oid = trigger_info.tgrelid
      JOIN pg_namespace AS namespace ON namespace.oid = table_info.relnamespace
      WHERE namespace.nspname = 'public'
        AND NOT trigger_info.tgisinternal
    ), '[]'::jsonb),
    'functions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', procedure_info.proname,
        'identityArguments', pg_get_function_identity_arguments(procedure_info.oid),
        'definition', pg_get_functiondef(procedure_info.oid)
      ) ORDER BY procedure_info.proname, pg_get_function_identity_arguments(procedure_info.oid))
      FROM pg_proc AS procedure_info
      JOIN pg_namespace AS namespace ON namespace.oid = procedure_info.pronamespace
      WHERE namespace.nspname = 'public'
    ), '[]'::jsonb),
    'tableGrants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'table', table_info.relname,
        'grantee', CASE WHEN grant_info.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grant_info.grantee) END,
        'privilege', grant_info.privilege_type,
        'grantable', grant_info.is_grantable
      ) ORDER BY table_info.relname, CASE WHEN grant_info.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grant_info.grantee) END, grant_info.privilege_type)
      FROM pg_class AS table_info
      JOIN pg_namespace AS namespace ON namespace.oid = table_info.relnamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(table_info.relacl, acldefault('r', table_info.relowner))) AS grant_info
      WHERE namespace.nspname = 'public'
        AND table_info.relkind IN ('r', 'p')
    ), '[]'::jsonb),
    'functionGrants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', procedure_info.proname,
        'identityArguments', pg_get_function_identity_arguments(procedure_info.oid),
        'grantee', CASE WHEN grant_info.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grant_info.grantee) END,
        'privilege', grant_info.privilege_type,
        'grantable', grant_info.is_grantable
      ) ORDER BY procedure_info.proname, pg_get_function_identity_arguments(procedure_info.oid), CASE WHEN grant_info.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grant_info.grantee) END, grant_info.privilege_type)
      FROM pg_proc AS procedure_info
      JOIN pg_namespace AS namespace ON namespace.oid = procedure_info.pronamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(procedure_info.proacl, acldefault('f', procedure_info.proowner))) AS grant_info
      WHERE namespace.nspname = 'public'
    ), '[]'::jsonb)
  ) AS catalog;
`;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function summary(category: CatalogCategory, row: Record<string, unknown>): string {
  if (category === "tables") return String(row.name);
  if (category === "columns") return `${row.table}.${row.name}`;
  if (category === "constraints" || category === "indexes" || category === "triggers") {
    return `${row.table}.${row.name}`;
  }
  if (category === "policies") return `${row.table}.${row.name}`;
  if (category === "functions") return `${row.name}(${row.identityArguments})`;
  if (category === "tableGrants") return `${row.table}:${row.grantee}:${row.privilege}`;
  return `${row.name}(${row.identityArguments}):${row.grantee}:${row.privilege}`;
}

function categoryDifference(
  category: CatalogCategory,
  production: Record<string, unknown>[],
  qa: Record<string, unknown>[]
): CategoryDifference {
  const productionRows = new Map(production.map((row) => [stableJson(row), summary(category, row)]));
  const qaRows = new Map(qa.map((row) => [stableJson(row), summary(category, row)]));
  return {
    productionOnly: [...productionRows]
      .filter(([row]) => !qaRows.has(row))
      .map(([, label]) => label)
      .sort(),
    qaOnly: [...qaRows]
      .filter(([row]) => !productionRows.has(row))
      .map(([, label]) => label)
      .sort(),
  };
}

export function compareCatalogs(production: CatalogSnapshot, qa: CatalogSnapshot): CatalogReport {
  const differences = Object.fromEntries(
    CATEGORIES.map((category) => [
      category,
      categoryDifference(category, production[category], qa[category]),
    ])
  ) as Record<CatalogCategory, CategoryDifference>;
  return {
    differences,
    hasDrift: Object.values(differences).some(
      ({ productionOnly, qaOnly }) => productionOnly.length > 0 || qaOnly.length > 0
    ),
  };
}

export function loadAuditConfigs(values = process.env): { production: AuditConfig; qa: AuditConfig } {
  const productionUrl = values.PROD_DATABASE_URL;
  const qaUrl = values.QA_DATABASE_URL;
  if (!productionUrl || !qaUrl) {
    throw new AuditConfigurationError(
      "direct audit requires PROD_DATABASE_URL and QA_DATABASE_URL (PostgreSQL connection strings)"
    );
  }
  if (productionUrl === qaUrl) {
    throw new AuditConfigurationError("production and QA direct audit URLs must not be identical");
  }
  for (const [label, databaseUrl] of [
    ["production", productionUrl],
    ["QA", qaUrl],
  ] as const) {
    try {
      const parsed = new URL(databaseUrl);
      if (!parsed.protocol.startsWith("postgres")) {
        throw new Error("not PostgreSQL");
      }
    } catch {
      throw new AuditConfigurationError(`${label} direct audit URL must be a PostgreSQL connection string`);
    }
  }
  return {
    production: { label: "production", databaseUrl: productionUrl },
    qa: { label: "QA", databaseUrl: qaUrl },
  };
}

export async function fetchCatalog(config: AuditConfig): Promise<CatalogSnapshot> {
  const sql = postgres(config.databaseUrl, { max: 1, prepare: false });
  try {
    const [row] = await sql.unsafe<{ catalog: CatalogSnapshot }[]>(CATALOG_QUERY);
    if (!row?.catalog || CATEGORIES.some((category) => !Array.isArray(row.catalog[category]))) {
      throw new Error(`${config.label} returned an invalid catalog snapshot`);
    }
    return row.catalog;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export function normalizeMigrationSource(source: string): string {
  return `${source
    .replace(
      /(\(\s*\d+\s*,\s*'[^']+'\s*,\s*)'(?:[0-9a-f]{64}|<[^']+>|PLACEHOLDER)'(\s*\))/gi,
      "$1'<checksum>'$2"
    )
    .trimEnd()}\n`;
}

export function checksumMigrationSource(source: string): string {
  return createHash("sha256").update(normalizeMigrationSource(source)).digest("hex");
}

export function discoverMigrations(directory = MIGRATIONS_DIRECTORY): MigrationFile[] {
  const files = readdirSync(directory)
    .filter((filename) => /^\d{3}_.+\.sql$/.test(filename))
    .sort();
  return files.map((filename) => {
    const version = Number(filename.slice(0, 3));
    return {
      version,
      filename,
      checksum: checksumMigrationSource(readFileSync(path.join(directory, filename), "utf8")),
    };
  });
}

export function compareLedger(
  expected: MigrationFile[],
  actual: MigrationLedgerEntry[]
): CategoryDifference {
  const expectedRows = new Map(expected.map((entry) => [entry.version, entry]));
  const actualRows = new Map(actual.map((entry) => [entry.version, entry]));
  const describe = (entry: MigrationFile) => `${String(entry.version).padStart(3, "0")} ${entry.filename}`;
  return {
    productionOnly: expected
      .filter((entry) => {
        const found = actualRows.get(entry.version);
        return !found || found.filename !== entry.filename || found.checksum !== entry.checksum;
      })
      .map(describe),
    qaOnly: actual
      .filter((entry) => {
        const found = expectedRows.get(entry.version);
        return !found || found.filename !== entry.filename || found.checksum !== entry.checksum;
      })
      .map(describe),
  };
}

export async function fetchLedger(config: AuditConfig): Promise<MigrationLedgerEntry[]> {
  const sql = postgres(config.databaseUrl, { max: 1, prepare: false });
  try {
    const rows = await sql<
      Array<{ version: number; filename: string; checksum: string; applied_at: string }>
    >`SELECT version, filename, checksum, applied_at::text FROM public.schema_migrations ORDER BY version`;
    return rows.map((row) => ({
      version: row.version,
      filename: row.filename,
      checksum: row.checksum,
      appliedAt: row.applied_at,
    }));
  } catch (error) {
    if (error instanceof postgres.PostgresError && error.code === "42P01") {
      throw new Error(`${config.label} is missing public.schema_migrations; apply migration 023 first`);
    }
    throw error;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export function renderCatalogReport(catalog: CatalogReport, ledger: LedgerReport): string {
  const lines = [
    `Database catalog audit: ${catalog.hasDrift || ledger.hasDrift ? "DRIFT FOUND" : "ALIGNED"}`,
    "",
    "Direct PostgreSQL catalog",
  ];
  for (const category of CATEGORIES) {
    const difference = catalog.differences[category];
    lines.push(
      `  ${category}: production-only=${difference.productionOnly.length}, QA-only=${difference.qaOnly.length}`
    );
    const examples = [...difference.productionOnly.map((entry) => `${entry} [production]`), ...difference.qaOnly.map((entry) => `${entry} [QA]`)];
    if (examples.length > 0) lines.push(`    examples: ${examples.slice(0, EXAMPLE_LIMIT).join("; ")}`);
  }
  lines.push("", "Migration ledger");
  for (const [label, difference] of [
    ["production", ledger.production],
    ["QA", ledger.qa],
  ] as const) {
    lines.push(`  ${label}: missing-or-changed=${difference.productionOnly.length}, unexpected=${difference.qaOnly.length}`);
    const examples = [
      ...difference.productionOnly.map((entry) => `${entry} [missing or changed]`),
      ...difference.qaOnly.map((entry) => `${entry} [unexpected]`),
    ];
    if (examples.length > 0) lines.push(`    examples: ${examples.slice(0, EXAMPLE_LIMIT).join("; ")}`);
  }
  return lines.join("\n");
}

export async function main(): Promise<void> {
  try {
    const { production, qa } = loadAuditConfigs();
    const expectedMigrations = discoverMigrations();
    const [productionCatalog, qaCatalog, productionLedger, qaLedger] = await Promise.all([
      fetchCatalog(production),
      fetchCatalog(qa),
      fetchLedger(production),
      fetchLedger(qa),
    ]);
    const catalog = compareCatalogs(productionCatalog, qaCatalog);
    const ledger: LedgerReport = {
      production: compareLedger(expectedMigrations, productionLedger),
      qa: compareLedger(expectedMigrations, qaLedger),
      hasDrift: false,
    };
    ledger.hasDrift = [ledger.production, ledger.qa].some(
      ({ productionOnly, qaOnly }) => productionOnly.length > 0 || qaOnly.length > 0
    );
    console.log(renderCatalogReport(catalog, ledger));
    process.exitCode = catalog.hasDrift || ledger.hasDrift ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`db:audit - ${message}`);
    process.exitCode = error instanceof AuditConfigurationError ? 2 : 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main();
}
