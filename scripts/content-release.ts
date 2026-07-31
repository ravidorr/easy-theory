import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export type ReviewRecord = {
  number: string;
  locale: "he" | "ar";
  sourceChecksum: string;
  reviewer: string;
  approvedAt: string;
  assetPath?: string;
};

export type ExplanationReview = ReviewRecord & {
  questionNumber: string;
  sourceUrl: string;
};

export type ContentReleaseManifest = {
  version: 1;
  status: "draft" | "approved";
  sources: Array<{
    kind: "question_bank" | "sign_catalog";
    sourceChecksum: string;
    sourceUrl: string;
    revisionId?: number;
    sourceSha1?: string;
  }>;
  questions: ReviewRecord[];
  signs: ReviewRecord[];
  explanations: ExplanationReview[];
};

export type ContentReleaseIssue = { path: string; message: string };

const SHA256_RE = /^[0-9a-f]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function reviewKey(record: ReviewRecord): string {
  return `${record.number}:${record.locale}`;
}

function assertReviewRecords(
  issues: ContentReleaseIssue[],
  records: ReviewRecord[],
  kind: string,
  sources: Set<string>
) {
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const path = `${kind}[${index}]`;
    if (!/^[0-9]+(?:פ)?$/.test(record.number)) issues.push({ path, message: "number must be a sign or question number" });
    if (!sources.has(record.sourceChecksum)) issues.push({ path, message: "sourceChecksum is not declared by sources" });
    if (!record.reviewer.trim()) issues.push({ path, message: "reviewer is required" });
    if (!DATE_RE.test(record.approvedAt)) issues.push({ path, message: "approvedAt must be YYYY-MM-DD" });
    const key = reviewKey(record);
    if (seen.has(key)) issues.push({ path, message: `duplicate review record ${key}` });
    seen.add(key);
  });
}

function assertBilingualLinkage(
  issues: ContentReleaseIssue[],
  records: ReviewRecord[],
  kind: "questions" | "signs"
) {
  const byNumber = new Map<string, ReviewRecord[]>();
  for (const record of records) {
    const group = byNumber.get(record.number) ?? [];
    group.push(record);
    byNumber.set(record.number, group);
  }
  for (const [number, group] of byNumber) {
    const he = group.find((record) => record.locale === "he");
    const ar = group.find((record) => record.locale === "ar");
    if (he && ar && he.sourceChecksum !== ar.sourceChecksum) {
      issues.push({ path: kind, message: `Hebrew and Arabic approvals use different sources for ${number}` });
    }
    if (kind === "signs" && he && ar && he.assetPath !== ar.assetPath) {
      issues.push({ path: kind, message: `Hebrew and Arabic approvals use different assets for ${number}` });
    }
  }
}

export function validateContentRelease(manifest: ContentReleaseManifest): ContentReleaseIssue[] {
  const issues: ContentReleaseIssue[] = [];
  if (manifest.version !== 1) issues.push({ path: "version", message: "must be 1" });
  const sourceChecksums = new Set<string>();
  const sourceKinds = new Map<string, "question_bank" | "sign_catalog">();
  for (const [index, source] of manifest.sources.entries()) {
    if (!SHA256_RE.test(source.sourceChecksum)) issues.push({ path: `sources[${index}]`, message: "sourceChecksum must be SHA-256" });
    if (!/^https:\/\//.test(source.sourceUrl)) issues.push({ path: `sources[${index}]`, message: "sourceUrl must be HTTPS" });
    if (sourceChecksums.has(source.sourceChecksum)) issues.push({ path: `sources[${index}]`, message: "duplicate sourceChecksum" });
    if (source.kind === "sign_catalog") {
      if (!Number.isSafeInteger(source.revisionId) || source.revisionId! < 1) {
        issues.push({ path: `sources[${index}]`, message: "sign catalog revisionId is required" });
      }
      if (!/^[0-9a-f]{40}$/.test(source.sourceSha1 ?? "")) {
        issues.push({ path: `sources[${index}]`, message: "sign catalog sourceSha1 must be MediaWiki SHA-1" });
      }
    }
    sourceChecksums.add(source.sourceChecksum);
    sourceKinds.set(source.sourceChecksum, source.kind);
  }
  assertReviewRecords(issues, manifest.questions, "questions", sourceChecksums);
  assertReviewRecords(issues, manifest.signs, "signs", sourceChecksums);
  assertReviewRecords(issues, manifest.explanations, "explanations", sourceChecksums);
  manifest.questions.forEach((record, index) => {
    if (sourceKinds.get(record.sourceChecksum) !== "question_bank") {
      issues.push({ path: `questions[${index}]`, message: "questions must use the question-bank source" });
    }
  });
  manifest.signs.forEach((record, index) => {
    if (sourceKinds.get(record.sourceChecksum) !== "sign_catalog") {
      issues.push({ path: `signs[${index}]`, message: "signs must use the pinned sign-catalog source" });
    }
  });
  assertBilingualLinkage(issues, manifest.questions, "questions");
  assertBilingualLinkage(issues, manifest.signs, "signs");
  manifest.explanations.forEach((explanation, index) => {
    if (explanation.number !== explanation.questionNumber) {
      issues.push({ path: `explanations[${index}]`, message: "number must equal questionNumber" });
    }
    if (!/^https:\/\//.test(explanation.sourceUrl)) {
      issues.push({ path: `explanations[${index}]`, message: "sourceUrl must be HTTPS" });
    }
    if (sourceKinds.get(explanation.sourceChecksum) !== "question_bank") {
      issues.push({ path: `explanations[${index}]`, message: "explanations must cite the question-bank source" });
    }
  });
  return issues;
}

function numbersFromSeed(source: string, question: boolean): string[] {
  const pattern = question
    ? /\('\w[\w-]*',\s*(\d+),/g
    : /\(gen_random_uuid\(\),\s*'([^']+)',/g;
  return [...source.matchAll(pattern)].map((match) => match[1]).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

export function validatePublishableRelease(
  manifest: ContentReleaseManifest,
  questionNumbers: string[],
  signNumbers: string[],
  assetExists: (path: string) => boolean = existsSync,
  questionImagePaths: string[] = []
): ContentReleaseIssue[] {
  const issues = validateContentRelease(manifest);
  if (manifest.status !== "approved") return [...issues, { path: "status", message: "release is not approved" }];
  for (const [kind, expected] of [["questions", questionNumbers], ["signs", signNumbers]] as const) {
    const actual = manifest[kind];
    for (const number of expected) {
      for (const locale of ["he", "ar"] as const) {
        if (!actual.some((record) => record.number === number && record.locale === locale)) {
          issues.push({ path: kind, message: `missing ${locale} approval for ${number}` });
        }
      }
    }
  }
  for (const sign of manifest.signs) {
    if (!sign.assetPath) issues.push({ path: `sign ${sign.number}`, message: "assetPath is required" });
    else if (!assetExists(sign.assetPath)) issues.push({ path: `sign ${sign.number}`, message: `asset is missing: ${sign.assetPath}` });
  }
  for (const imagePath of questionImagePaths) {
    if (!assetExists(imagePath)) {
      issues.push({ path: "question images", message: `asset is missing: ${imagePath}` });
    }
  }
  return issues;
}

function imagePathsFromQuestionSeed(source: string): string[] {
  return [...new Set([...source.matchAll(/'((?:\/questions|\/signs)\/[^']+)'/g)].map((match) => match[1]))];
}

function main(): void {
  const publish = process.argv.includes("--publish");
  const manifestPath = "content/reviews/release.json";
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ContentReleaseManifest;
  const questionSeed = readFileSync("seeds/questions.sql", "utf8");
  const issues = publish
    ? validatePublishableRelease(
        manifest,
        numbersFromSeed(questionSeed, true),
        numbersFromSeed(readFileSync("seeds/signs.sql", "utf8"), false),
        (assetPath) => existsSync(join("public", assetPath)),
        imagePathsFromQuestionSeed(questionSeed)
      )
    : validateContentRelease(manifest);
  if (issues.length) {
    for (const issue of issues) console.error(`${issue.path}: ${issue.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(publish ? "Content release is publishable." : "Content review manifest is well-formed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
