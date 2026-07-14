/**
 * Mechanical gate for QA run reports — the anti-false-confidence check.
 * Rejects any report where a charter check lacks a verdict, a pass/fail lacks
 * on-disk evidence, a finding is incomplete, the NOT-tested section is empty,
 * or the coverage arithmetic is wrong.
 *
 * Usage:
 *   pnpm qa:validate-report <run-dir> <charter-path>
 *   pnpm qa:validate-report qa/runs/2026-07-13T14-30_001-home-and-quiz qa/charters/001-home-and-quiz.md
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const VERDICTS = ["pass", "fail", "blocked", "not-checked"] as const;
const SEVERITIES = ["blocker", "major", "minor", "cosmetic", "question"] as const;
const CONFIDENCES = ["high", "medium", "low"] as const;
const CATEGORIES = [
  "functional",
  "data",
  "copy",
  "rtl",
  "a11y",
  "console",
  "network",
  "performance",
] as const;

type Check = {
  id?: string;
  verdict?: string;
  observed?: string;
  evidence?: string[];
  reason?: string | null;
};

type Finding = {
  id?: string;
  title?: string;
  severity?: string;
  confidence?: string;
  category?: string;
  repro_steps?: string[];
  expected?: string;
  actual?: string;
  evidence?: string[];
};

const errors: string[] = [];

function err(message: string): void {
  errors.push(message);
}

const [runDir, charterPath] = process.argv.slice(2);
if (!runDir || !charterPath) {
  console.error("usage: pnpm qa:validate-report <run-dir> <charter-path>");
  process.exit(1);
}

if (!existsSync(runDir)) {
  console.error(`validate-report - run dir not found: ${runDir}`);
  process.exit(1);
}
if (!existsSync(charterPath)) {
  console.error(`validate-report - charter not found: ${charterPath}`);
  process.exit(1);
}

const findingsPath = join(runDir, "findings.json");
const reportPath = join(runDir, "report.md");
if (!existsSync(findingsPath)) err("findings.json is missing from the run dir");
if (!existsSync(reportPath)) err("report.md is missing from the run dir");

// Check IDs come straight from the charter frontmatter — no YAML parser needed.
const charterCheckIds = [
  ...readFileSync(charterPath, "utf8").matchAll(/^\s*- id: (CHK-[A-Z0-9-]+)\s*$/gm),
].map((m) => m[1]);
if (charterCheckIds.length === 0) {
  err(`charter declares no checks (no '- id: CHK-*' lines found): ${charterPath}`);
}

// Evidence entries may carry a line fragment (network.log#L12) — strip it.
function evidenceExists(entry: string): boolean {
  return existsSync(join(runDir, entry.split("#")[0]));
}

if (existsSync(findingsPath)) {
  let report: {
    checks?: Check[];
    findings?: Finding[];
    not_tested?: string[];
    coverage_summary?: Record<string, number>;
    environment?: Record<string, string>;
  };
  try {
    report = JSON.parse(readFileSync(findingsPath, "utf8"));
  } catch (parseError) {
    console.error(`validate-report - findings.json is not valid JSON: ${String(parseError)}`);
    process.exit(1);
  }

  const checks = report.checks ?? [];
  const seen = new Map<string, number>();
  for (const check of checks) {
    seen.set(check.id ?? "?", (seen.get(check.id ?? "?") ?? 0) + 1);
  }
  for (const id of charterCheckIds) {
    const count = seen.get(id) ?? 0;
    if (count === 0) err(`check ${id} from the charter has no verdict in findings.json`);
    if (count > 1) err(`check ${id} has ${count} entries - must be exactly one`);
  }
  for (const id of seen.keys()) {
    if (!charterCheckIds.includes(id)) {
      err(`check ${id} appears in findings.json but is not declared in the charter`);
    }
  }

  for (const check of checks) {
    const id = check.id ?? "?";
    if (!VERDICTS.includes(check.verdict as (typeof VERDICTS)[number])) {
      err(`check ${id}: verdict "${check.verdict}" is not one of ${VERDICTS.join("/")}`);
      continue;
    }
    if (check.verdict === "pass" || check.verdict === "fail") {
      if (!check.observed?.trim()) {
        err(`check ${id}: ${check.verdict} requires a non-empty "observed" statement`);
      }
      if (!check.evidence?.length) {
        err(`check ${id}: ${check.verdict} requires evidence - a ${check.verdict} without evidence is invalid`);
      } else {
        for (const entry of check.evidence) {
          if (!evidenceExists(entry)) err(`check ${id}: evidence file not found in run dir: ${entry}`);
        }
      }
    } else if (!check.reason?.trim()) {
      err(`check ${id}: ${check.verdict} requires a non-empty "reason"`);
    }
  }

  const findings = report.findings ?? [];
  for (const finding of findings) {
    const id = finding.id ?? "?";
    if (!finding.title?.trim()) err(`finding ${id}: missing title`);
    if (!SEVERITIES.includes(finding.severity as (typeof SEVERITIES)[number])) {
      err(`finding ${id}: severity "${finding.severity}" is not one of ${SEVERITIES.join("/")}`);
    }
    if (!CONFIDENCES.includes(finding.confidence as (typeof CONFIDENCES)[number])) {
      err(`finding ${id}: confidence "${finding.confidence}" is not one of ${CONFIDENCES.join("/")}`);
    }
    if (!CATEGORIES.includes(finding.category as (typeof CATEGORIES)[number])) {
      err(`finding ${id}: category "${finding.category}" is not one of ${CATEGORIES.join("/")}`);
    }
    if (!finding.repro_steps?.length) err(`finding ${id}: repro_steps must be non-empty`);
    if (!finding.expected?.trim()) err(`finding ${id}: missing "expected"`);
    if (!finding.actual?.trim()) err(`finding ${id}: missing "actual"`);
    if (!finding.evidence?.length) {
      err(`finding ${id}: evidence must be non-empty`);
    } else {
      for (const entry of finding.evidence) {
        if (!evidenceExists(entry)) err(`finding ${id}: evidence file not found in run dir: ${entry}`);
      }
    }
  }

  if (!report.not_tested?.length) {
    err('not_tested must be non-empty - every run leaves something untested; say what');
  }

  const summary = report.coverage_summary;
  if (!summary) {
    err("coverage_summary is missing");
  } else {
    const tally = { total: checks.length, pass: 0, fail: 0, blocked: 0, not_checked: 0 };
    for (const check of checks) {
      if (check.verdict === "pass") tally.pass += 1;
      else if (check.verdict === "fail") tally.fail += 1;
      else if (check.verdict === "blocked") tally.blocked += 1;
      else if (check.verdict === "not-checked") tally.not_checked += 1;
    }
    for (const [key, expected] of Object.entries(tally)) {
      if (summary[key] !== expected) {
        err(`coverage_summary.${key} is ${summary[key]}, but the checks tally to ${expected}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`validate-report - ${errors.length} problem(s):`);
  for (const message of errors) console.error(`  - ${message}`);
  process.exit(1);
}
console.error("validate-report - OK: report is complete and evidence-backed");
