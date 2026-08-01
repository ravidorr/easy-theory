/**
 * Compare the live Hebrew B-license question bank with the pinned Ministry XML.
 *
 * Usage:
 *   pnpm content:audit-questions
 *   pnpm content:audit-questions -- --env .env.qa --target QA
 *   pnpm content:audit-questions -- --output .context/my-audit
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { configFromEnv, parseEnv, type DatabaseConfig } from "./compare-databases";

const PAGE_SIZE = 1_000;
const CAR_B = "В"; // Cyrillic capital Ve, used for the private-car licence in the Ministry feed.

const TOPIC_SLUGS: Record<string, string> = {
  תמרורים: "signs",
  "חוקי התנועה": "traffic-laws",
  בטיחות: "safety",
  "הכרת הרכב": "vehicle",
};

export type SourceQuestion = {
  questionNumber: number;
  topicSlug: string;
  question: string;
  options: [string, string, string, string];
  correctOption: "a" | "b" | "c" | "d";
};

export type DatabaseQuestion = {
  id: string;
  topic_id: string | null;
  question_number: number;
  question_he: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  is_active: boolean;
};

export type AuditIssue = {
  kind:
    | "missing"
    | "unexpected"
    | "duplicate"
    | "inactive-source"
    | "topic"
    | "question"
    | "option-order"
    | "correct_option"
    | "malformed-row";
  questionNumber: number | null;
  field?: string;
  official?: unknown;
  app?: unknown;
};

export type AuditReport = {
  generatedAt: string;
  target: DatabaseConfig["label"];
  activitySource: "is_active" | "legacy-all-rows";
  sourceChecksum: string;
  officialQuestionCount: number;
  databaseQuestionCount: number;
  activeDatabaseQuestionCount: number;
  comparedQuestionCount: number;
  mismatchCount: number;
  mismatches: AuditIssue[];
};

type AuditOptions = {
  envPath: string;
  target: DatabaseConfig["label"];
  outputDir: string;
};

function optionLetter(index: number): SourceQuestion["correctOption"] {
  return ["a", "b", "c", "d"][index] as SourceQuestion["correctOption"];
}

export function normalizeText(value: string): string {
  return decodeHtml(stripMarkup(value))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .normalize("NFC");
}

function stripMarkup(value: string): string {
  let result = "";
  let inTag = false;
  let quote: "'" | '"' | null = null;
  for (const character of value) {
    if (!inTag) {
      if (character === "<") inTag = true;
      else result += character;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === ">") {
      inTag = false;
    }
  }
  return result;
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: "\u00a0",
    quot: '"',
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    const lower = body.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return named[lower] ?? entity;
  });
}

function tagValue(item: string, tag: string): string | null {
  const match = item.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1] ?? null;
}

function cdataValue(value: string): string {
  const match = value.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return match?.[1] ?? value;
}

export function verifyPinnedQuestionBankChecksum(xml: string, manifest: unknown): string {
  const checksum = createHash("sha256").update(xml).digest("hex");
  if (typeof manifest !== "object" || manifest === null) {
    throw new Error("content review manifest is not an object");
  }
  const sources = (manifest as { sources?: unknown }).sources;
  if (!Array.isArray(sources)) throw new Error("content review manifest has no sources array");
  const questionBank = sources.find(
    (source): source is { kind: string; sourceChecksum: string } =>
      typeof source === "object" &&
      source !== null &&
      (source as { kind?: unknown }).kind === "question_bank" &&
      typeof (source as { sourceChecksum?: unknown }).sourceChecksum === "string"
  );
  if (!questionBank) throw new Error("content review manifest has no question_bank source checksum");
  if (questionBank.sourceChecksum !== checksum) {
    throw new Error(
      `Ministry XML SHA-256 ${checksum} does not match the pinned question_bank checksum ${questionBank.sourceChecksum}`
    );
  }
  return checksum;
}

/** Parses the Ministry RSS without sharing the importer's parser. */
export function parseMinistryQuestions(xml: string): SourceQuestion[] {
  const questions: SourceQuestion[] = [];
  const seen = new Set<number>();
  const sourceErrors: string[] = [];

  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const item = match[1];
    const description = tagValue(item, "description");
    if (!description) continue;
    const descriptionHtml = cdataValue(description).trim();
    if (!descriptionHtml.includes(`«${CAR_B}»`)) continue;

    const title = tagValue(item, "title");
    const titleMatch = title && normalizeText(title).match(/^(\d+)\.\s*(.+)$/u);
    if (!titleMatch) {
      sourceErrors.push("B-license item has no numbered question title");
      continue;
    }
    const questionNumber = Number(titleMatch[1]);
    if (seen.has(questionNumber)) {
      sourceErrors.push(`duplicate B-license question ${questionNumber}`);
      continue;
    }
    seen.add(questionNumber);

    const category = normalizeText(tagValue(item, "category") ?? "");
    const topicSlug = TOPIC_SLUGS[category];
    if (!topicSlug) {
      sourceErrors.push(`question ${questionNumber} has unknown topic ${JSON.stringify(category)}`);
      continue;
    }

    const optionHtml = [...descriptionHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((entry) => entry[1]);
    if (optionHtml.length !== 4) {
      sourceErrors.push(`question ${questionNumber} has ${optionHtml.length} options, expected 4`);
      continue;
    }
    const markers = optionHtml.flatMap((option, index) =>
      [...option.matchAll(/\bid\s*=\s*["']correctAnswer0*(\d+)["']/gi)]
        .filter((entry) => Number(entry[1]) === questionNumber)
        .map(() => index)
    );
    if (markers.length !== 1) {
      sourceErrors.push(`question ${questionNumber} has ${markers.length} correct-answer markers, expected 1`);
      continue;
    }

    questions.push({
      questionNumber,
      topicSlug,
      question: normalizeText(titleMatch[2]),
      options: optionHtml.map(normalizeText) as SourceQuestion["options"],
      correctOption: optionLetter(markers[0]),
    });
  }

  if (sourceErrors.length > 0) throw new Error(`Ministry source is malformed:\n${sourceErrors.join("\n")}`);
  return questions;
}

function isDatabaseQuestion(value: unknown): value is DatabaseQuestion {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    (typeof row.topic_id === "string" || row.topic_id === null) &&
    typeof row.question_number === "number" &&
    Number.isInteger(row.question_number) &&
    typeof row.question_he === "string" &&
    typeof row.option_a === "string" &&
    typeof row.option_b === "string" &&
    typeof row.option_c === "string" &&
    typeof row.option_d === "string" &&
    typeof row.correct_option === "string" &&
    typeof row.is_active === "boolean"
  );
}

function appOptions(question: DatabaseQuestion): [string, string, string, string] {
  return [question.option_a, question.option_b, question.option_c, question.option_d].map(normalizeText) as [
    string,
    string,
    string,
    string,
  ];
}

export function compareQuestions(
  official: SourceQuestion[],
  databaseRows: unknown[],
  topicSlugsById: Map<string, string>
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const allRowsByNumber = new Map<number, DatabaseQuestion[]>();
  for (const row of databaseRows) {
    if (!isDatabaseQuestion(row)) {
      issues.push({ kind: "malformed-row", questionNumber: null, app: row });
      continue;
    }
    const rows = allRowsByNumber.get(row.question_number) ?? [];
    rows.push(row);
    allRowsByNumber.set(row.question_number, rows);
  }

  const officialByNumber = new Map(official.map((question) => [question.questionNumber, question]));
  for (const source of official) {
    const rows = allRowsByNumber.get(source.questionNumber) ?? [];
    const active = rows.filter((row) => row.is_active);
    if (active.length === 0) {
      issues.push({
        kind: rows.length > 0 ? "inactive-source" : "missing",
        questionNumber: source.questionNumber,
        official: source,
      });
      continue;
    }
    if (active.length > 1) {
      issues.push({
        kind: "duplicate",
        questionNumber: source.questionNumber,
        app: active.map((row) => row.id),
      });
      continue;
    }

    const app = active[0];
    const appTopic = app.topic_id ? topicSlugsById.get(app.topic_id) : undefined;
    if (appTopic !== source.topicSlug) {
      issues.push({ kind: "topic", questionNumber: source.questionNumber, field: "topic", official: source.topicSlug, app: appTopic ?? null });
    }
    if (normalizeText(app.question_he) !== source.question) {
      issues.push({ kind: "question", questionNumber: source.questionNumber, field: "question_he", official: source.question, app: normalizeText(app.question_he) });
    }
    const options = appOptions(app);
    if (!options.every((option, index) => option === source.options[index])) {
      issues.push({ kind: "option-order", questionNumber: source.questionNumber, field: "option_a..option_d", official: source.options, app: options });
    }
    if (app.correct_option !== source.correctOption) {
      issues.push({ kind: "correct_option", questionNumber: source.questionNumber, field: "correct_option", official: source.correctOption, app: app.correct_option });
    }
  }

  for (const [questionNumber, rows] of allRowsByNumber) {
    for (const row of rows.filter((candidate) => candidate.is_active)) {
      if (!officialByNumber.has(questionNumber)) {
        issues.push({ kind: "unexpected", questionNumber, app: row });
      }
    }
  }
  return issues.sort((left, right) => (left.questionNumber ?? -1) - (right.questionNumber ?? -1) || left.kind.localeCompare(right.kind));
}

function headers(config: DatabaseConfig): HeadersInit {
  return {
    Accept: "application/json",
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
  };
}

export async function fetchAllRows(
  config: DatabaseConfig,
  table: "topics" | "questions",
  select: string,
  fetchImpl: typeof fetch = fetch
): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const response = await fetchImpl(
      `${config.url}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=${table === "questions" ? "question_number.asc" : "id.asc"}`,
      { method: "GET", headers: { ...headers(config), Range: `${start}-${start + PAGE_SIZE - 1}` } }
    );
    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 500);
      throw new Error(`${config.label} ${table} request failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    const page: unknown = await response.json();
    if (!Array.isArray(page)) throw new Error(`${config.label} ${table} returned an invalid row set`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function fetchQuestionsForAudit(
  config: DatabaseConfig,
  fetchImpl: typeof fetch = fetch
): Promise<{ rows: unknown[]; activitySource: AuditReport["activitySource"] }> {
  const withActivityField = "id,topic_id,question_number,question_he,option_a,option_b,option_c,option_d,correct_option,is_active";
  try {
    return { rows: await fetchAllRows(config, "questions", withActivityField, fetchImpl), activitySource: "is_active" };
  } catch (error) {
    if (!isMissingIsActiveColumn(error)) throw error;
  }
  const legacyFields = "id,topic_id,question_number,question_he,option_a,option_b,option_c,option_d,correct_option";
  const rows = await fetchAllRows(config, "questions", legacyFields, fetchImpl);
  return {
    rows: rows.map((row) => (typeof row === "object" && row !== null ? { ...row, is_active: true } : row)),
    activitySource: "legacy-all-rows",
  };
}

function isMissingIsActiveColumn(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    /column questions\.is_active does not exist/.test(error.message) ||
    (/"code"\s*:\s*"PGRST204"/.test(error.message) && /is_active/.test(error.message))
  );
}

export function renderMarkdown(report: AuditReport): string {
  const lines = [
    "# Hebrew question content audit",
    "",
    `- Target: ${report.target}`,
    `- Active content source: ${report.activitySource}`,
    `- Ministry XML SHA-256: ${report.sourceChecksum}`,
    `- Official B-license questions: ${report.officialQuestionCount}`,
    `- Database questions: ${report.databaseQuestionCount} (${report.activeDatabaseQuestionCount} active)`,
    `- Compared: ${report.comparedQuestionCount}`,
    `- Mismatches: ${report.mismatchCount}`,
    "",
  ];
  if (report.mismatches.length === 0) return [...lines, "Result: PASS"].join("\n") + "\n";
  lines.push("## Mismatches", "");
  for (const issue of report.mismatches) {
    lines.push(`- Q${issue.questionNumber ?? "unknown"} - ${issue.kind}${issue.field ? ` (${issue.field})` : ""}`);
    if (issue.official !== undefined) lines.push(`  - Official: \`${JSON.stringify(issue.official)}\``);
    if (issue.app !== undefined) lines.push(`  - App: \`${JSON.stringify(issue.app)}\``);
  }
  return lines.join("\n") + "\n";
}

export function writeAuditReport(outputDir: string, report: AuditReport): void {
  if (existsSync(outputDir)) throw new Error(`audit output directory already exists: ${outputDir}`);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outputDir, "report.md"), renderMarkdown(report));
}

export function optionsFromArgs(args: string[]): AuditOptions {
  let envPath = ".env.local";
  let target: DatabaseConfig["label"] = "production";
  let outputDir = join(".context", `question-audit-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--") continue; // pnpm forwards this separator to the script.
    if (value === "--env") envPath = args[++index] ?? "";
    else if (value === "--target") {
      const selected = args[++index];
      if (selected !== "production" && selected !== "QA") throw new Error("--target must be production or QA");
      target = selected;
    } else if (value === "--output") outputDir = args[++index] ?? "";
    else throw new Error(`unknown argument: ${value}`);
  }
  if (!envPath || !outputDir) throw new Error("--env and --output require a value");
  return { envPath, target, outputDir };
}

async function main(): Promise<void> {
  const options = optionsFromArgs(process.argv.slice(2));
  const config = configFromEnv(parseEnv(readFileSync(options.envPath, "utf8")), options.target);
  const xml = readFileSync("seeds/theoryexam.xml", "utf8");
  const sourceChecksum = verifyPinnedQuestionBankChecksum(
    xml,
    JSON.parse(readFileSync("content/reviews/release.json", "utf8"))
  );
  const official = parseMinistryQuestions(xml);
  const [topics, questionResult] = await Promise.all([
    fetchAllRows(config, "topics", "id,slug"),
    fetchQuestionsForAudit(config),
  ]);
  const questions = questionResult.rows;
  const topicSlugs = new Map(
    topics.flatMap((topic) => {
      if (typeof topic !== "object" || topic === null) return [];
      const row = topic as Record<string, unknown>;
      return typeof row.id === "string" && typeof row.slug === "string" ? [[row.id, row.slug] as const] : [];
    })
  );
  const mismatches = compareQuestions(official, questions, topicSlugs);
  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    target: config.label,
    activitySource: questionResult.activitySource,
    sourceChecksum,
    officialQuestionCount: official.length,
    databaseQuestionCount: questions.length,
    activeDatabaseQuestionCount: questions.filter((question) => isDatabaseQuestion(question) && question.is_active).length,
    comparedQuestionCount: official.filter((source) => {
      const app = questions.filter((question) => isDatabaseQuestion(question) && question.question_number === source.questionNumber && question.is_active);
      return app.length === 1;
    }).length,
    mismatchCount: mismatches.length,
    mismatches,
  };
  writeAuditReport(options.outputDir, report);
  console.log(`Question audit report: ${options.outputDir}`);
  console.log(`Question audit: ${report.officialQuestionCount} official, ${report.activeDatabaseQuestionCount} active, ${report.mismatchCount} mismatches`);
  if (mismatches.length > 0) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("audit-question-content.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
