import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllRows,
  loadConfigs,
  validateDistinctProjects,
  type DatabaseConfig,
} from "./compare-databases";

type Row = Record<string, unknown>;
type ReferenceTable = "topics" | "questions" | "signs" | "videos" | "resources";

export type SyncOperation = {
  table: ReferenceTable;
  keyField: string;
  key: string | number;
  payload: Row;
  action: "insert" | "update";
};

export type TableSyncPlan = {
  table: ReferenceTable;
  productionCount: number;
  qaCount: number;
  inserts: SyncOperation[];
  updates: SyncOperation[];
  qaOnlyKeys: Array<string | number>;
};

const TABLES: ReferenceTable[] = ["topics", "signs", "videos", "resources", "questions"];
const KEY_FIELDS: Record<ReferenceTable, string> = {
  topics: "slug",
  questions: "question_number",
  signs: "sign_number",
  videos: "youtube_id",
  resources: "href",
};

function isObject(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonical(nested)])
  );
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function without(row: Row, fields: string[]): Row {
  return Object.fromEntries(Object.entries(row).filter(([field]) => !fields.includes(field)));
}

function rowKey(table: ReferenceTable, row: Row): string | number {
  const field = KEY_FIELDS[table];
  const value = row[field];
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${table} row has no usable ${field}`);
  }
  return value;
}

function indexRows(table: ReferenceTable, rows: Row[]): Map<string | number, Row> {
  const result = new Map<string | number, Row>();
  for (const row of rows) {
    const key = rowKey(table, row);
    if (result.has(key)) throw new Error(`${table} contains duplicate reference key ${key}`);
    result.set(key, row);
  }
  return result;
}

function topicMaps(productionTopics: Row[], qaTopics: Row[]) {
  const productionSlugById = new Map<string, string>();
  const qaIdBySlug = new Map<string, string>();
  for (const topic of productionTopics) {
    if (typeof topic.id === "string" && typeof topic.slug === "string") {
      productionSlugById.set(topic.id, topic.slug);
    }
  }
  for (const topic of qaTopics) {
    if (typeof topic.id === "string" && typeof topic.slug === "string") {
      qaIdBySlug.set(topic.slug, topic.id);
    }
  }
  return { productionSlugById, qaIdBySlug };
}

function targetPayload(
  table: ReferenceTable,
  productionRow: Row,
  productionSlugById: Map<string, string>,
  qaIdBySlug: Map<string, string>
): Row {
  const payload = without(productionRow, ["id"]);
  if (table !== "questions") return payload;
  if (typeof productionRow.topic_id !== "string") return { ...payload, topic_id: null };
  const slug = productionSlugById.get(productionRow.topic_id);
  const qaTopicId = slug ? qaIdBySlug.get(slug) : undefined;
  if (!slug || !qaTopicId) {
    throw new Error(
      `questions row ${String(productionRow.question_number)} references an unmapped topic`
    );
  }
  return { ...payload, topic_id: qaTopicId };
}

export function buildTablePlan(
  table: ReferenceTable,
  productionRows: Row[],
  qaRows: Row[],
  productionTopics: Row[],
  qaTopics: Row[]
): TableSyncPlan {
  const production = indexRows(table, productionRows);
  const qa = indexRows(table, qaRows);
  const { productionSlugById, qaIdBySlug } = topicMaps(productionTopics, qaTopics);
  const inserts: SyncOperation[] = [];
  const updates: SyncOperation[] = [];
  for (const [key, productionRow] of production) {
    const payload = targetPayload(table, productionRow, productionSlugById, qaIdBySlug);
    const operation: SyncOperation = {
      table,
      keyField: KEY_FIELDS[table],
      key,
      payload,
      action: qa.has(key) ? "update" : "insert",
    };
    const qaRow = qa.get(key);
    if (!qaRow) {
      inserts.push(operation);
    } else if (!equal(payload, without(qaRow, ["id"]))) {
      updates.push(operation);
    }
  }
  return {
    table,
    productionCount: productionRows.length,
    qaCount: qaRows.length,
    inserts,
    updates,
    qaOnlyKeys: [...qa.keys()].filter((key) => !production.has(key)),
  };
}

async function fetchReferenceRows(
  production: DatabaseConfig,
  qa: DatabaseConfig
): Promise<{
  productionRows: Map<ReferenceTable, Row[]>;
  qaRows: Map<ReferenceTable, Row[]>;
}> {
  const pairs = await Promise.all(
    TABLES.map(async (table) => {
      const [productionTableRows, qaTableRows] = await Promise.all([
        fetchAllRows(production, table),
        fetchAllRows(qa, table),
      ]);
      return [table, productionTableRows, qaTableRows] as const;
    })
  );
  return {
    productionRows: new Map(pairs.map(([table, rows]) => [table, rows])),
    qaRows: new Map(pairs.map(([table, , rows]) => [table, rows])),
  };
}

export async function buildSyncPlan(
  production: DatabaseConfig,
  qa: DatabaseConfig
): Promise<TableSyncPlan[]> {
  validateDistinctProjects(production, qa);
  const { productionRows, qaRows } = await fetchReferenceRows(production, qa);
  const productionTopics = productionRows.get("topics") ?? [];
  const qaTopics = qaRows.get("topics") ?? [];
  return TABLES.map((table) =>
    buildTablePlan(
      table,
      productionRows.get(table) ?? [],
      qaRows.get(table) ?? [],
      productionTopics,
      qaTopics
    )
  );
}

async function backupAffectedData(
  production: DatabaseConfig,
  qa: DatabaseConfig
): Promise<string> {
  const [productionSrs, qaSrs, ...qaReferenceRows] = await Promise.all([
    fetchAllRows(production, "user_srs_cards"),
    fetchAllRows(qa, "user_srs_cards"),
    ...TABLES.map((table) => fetchAllRows(qa, table)),
  ]);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `.context/database-alignment-backup-${timestamp}.json`;
  mkdirSync(".context", { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        production: { user_srs_cards: productionSrs },
        qa: {
          user_srs_cards: qaSrs,
          referenceData: Object.fromEntries(
            TABLES.map((table, index) => [table, qaReferenceRows[index]])
          ),
        },
      },
      null,
      2
    )
  );
  return path;
}

async function runWithConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>
): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (next < values.length) {
        const current = values[next];
        next += 1;
        await worker(current);
      }
    })
  );
}

export async function applyPlan(
  qa: DatabaseConfig,
  plans: TableSyncPlan[],
  operationWriter?: (operation: SyncOperation) => Promise<void>
): Promise<void> {
  const qaOnly = plans.flatMap((plan) =>
    plan.qaOnlyKeys.map((key) => `${plan.table}.${plan.keyField}=${key}`)
  );
  if (qaOnly.length > 0) {
    throw new Error(
      `QA contains ${qaOnly.length} reference rows absent from production; refusing to delete them`
    );
  }
  const client = operationWriter
    ? null
    : createClient(qa.url, qa.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
  const writeOperation =
    operationWriter ??
    (async (operation: SyncOperation) => {
      const query =
        operation.action === "insert"
          ? client!.from(operation.table).insert(operation.payload)
          : client!
              .from(operation.table)
              .update(operation.payload)
              .eq(operation.keyField, operation.key);
      const { error } = await query;
      if (error) {
        throw new Error(
          `${operation.action} failed for ${operation.table}.${operation.keyField}=${operation.key}: ${error.message}`
        );
      }
    });
  const orderedPlans = [...plans].sort(
    (left, right) => TABLES.indexOf(left.table) - TABLES.indexOf(right.table)
  );
  for (const plan of orderedPlans) {
    await runWithConcurrency([...plan.inserts, ...plan.updates], 10, writeOperation);
  }
}

function renderPlan(plans: TableSyncPlan[]): string {
  const lines = ["Production to QA reference sync"];
  for (const plan of plans) {
    lines.push(
      `  ${plan.table}: production=${plan.productionCount}, QA=${plan.qaCount}, ` +
        `insert=${plan.inserts.length}, update=${plan.updates.length}, QA-only=${plan.qaOnlyKeys.length}`
    );
  }
  return lines.join("\n");
}

export async function main(): Promise<void> {
  try {
    const args = new Set(process.argv.slice(2));
    const unknown = [...args].filter((arg) => arg !== "--apply" && arg !== "--backup");
    if (unknown.length > 0 || (args.has("--apply") && args.has("--backup"))) {
      throw new Error("usage: pnpm db:sync-reference [--apply | --backup]");
    }
    const { production, qa } = loadConfigs();
    if (args.has("--backup")) {
      console.log(`Database alignment backup: ${await backupAffectedData(production, qa)}`);
      return;
    }
    const plans = await buildSyncPlan(production, qa);
    console.log(renderPlan(plans));
    if (!args.has("--apply")) {
      console.log("Dry run only. Pass --apply to write these changes to QA.");
      return;
    }
    const backupPath = await backupAffectedData(production, qa);
    console.log(`Backup created: ${backupPath}`);
    await applyPlan(qa, plans);
    console.log("Reference data sync applied to QA.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`db:sync-reference - ${message}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main();
}
