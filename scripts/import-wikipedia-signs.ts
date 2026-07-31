import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

export const WIKIPEDIA_PAGE = "תמרורים_בישראל";
export const DEFAULT_WIKIPEDIA_REVISION = 43643480;

export type WikipediaSign = {
  signNumber: string;
  nameHe: string;
  imageFile: string;
  category: string | null;
};

export type WikipediaSignImport = {
  sourceUrl: string;
  revisionId: number;
  sourceSha1: string | null;
  snapshotSha256: string;
  signs: WikipediaSign[];
  duplicateSignNumbers: string[];
  missingExpectedSignNumbers: string[];
  unclassifiedSignNumbers: string[];
};

export type ParsedWikipediaSignCatalog = Omit<WikipediaSignImport, "sourceUrl" | "revisionId" | "sourceSha1" | "snapshotSha256" | "missingExpectedSignNumbers">;

const CATEGORY_BY_HEADING: Array<[RegExp, string]> = [
  [/אזהרה והתראה/, "warning"],
  [/הוריה/, "mandatory"],
  [/זכות קדימה/, "right_of_way"],
  [/איסורים והגבלות/, "prohibition"],
  [/תחבורה ציבורית/, "public_transport"],
  [/מודיעין והדרכה/, "guidance"],
  [/רמזורים ובקרת נתיבים/, "traffic_light"],
  [/סימון על פני הדרך/, "road_surface"],
  [/באתר עבודה/, "work_zone"],
];

function categoryForHeading(heading: string): string | null {
  return CATEGORY_BY_HEADING.find(([pattern]) => pattern.test(heading))?.[1] ?? null;
}

function cleanWikitext(value: string): string {
  // Import output is data-only JSON, never HTML. Preserve markup literally
  // instead of attempting incomplete HTML sanitization with a regex.
  return value
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses gallery rows from a pinned Hebrew Wikipedia revision. */
export function parseWikipediaSignWikitext(wikitext: string): ParsedWikipediaSignCatalog {
  let category: string | null = null;
  const signs: WikipediaSign[] = [];

  for (const rawLine of wikitext.split(/\r?\n/)) {
    const heading = rawLine.match(/^===\s*(.+?)\s*===\s*$/);
    if (heading) {
      category = categoryForHeading(cleanWikitext(heading[1]));
      continue;
    }
    const row = rawLine.match(/^\s*קובץ:([^|]+)\|\s*תמרור\s+(\d{3,4}(?:פ)?)\s*-\s*(.+?)\s*$/);
    if (!row) continue;
    signs.push({
      imageFile: cleanWikitext(row[1]),
      signNumber: row[2],
      nameHe: cleanWikitext(row[3]),
      category,
    });
  }

  const occurrences = new Map<string, number>();
  for (const sign of signs) occurrences.set(sign.signNumber, (occurrences.get(sign.signNumber) ?? 0) + 1);
  return {
    signs,
    duplicateSignNumbers: [...occurrences].filter(([, count]) => count > 1).map(([number]) => number).sort(),
    unclassifiedSignNumbers: signs.filter((sign) => sign.category == null).map((sign) => sign.signNumber).sort(),
  };
}

export function missingExpectedSignNumbers(signs: WikipediaSign[], expected: Iterable<string>): string[] {
  const imported = new Set(signs.map((sign) => sign.signNumber));
  return [...new Set(expected)].filter((number) => !imported.has(number)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

export function permanentWikipediaUrl(revisionId: number): string {
  return `https://he.wikipedia.org/w/index.php?title=${encodeURIComponent(WIKIPEDIA_PAGE)}&oldid=${revisionId}#לוח_התמרורים_בישראל`;
}

export async function fetchWikipediaSignImport(
  revisionId = DEFAULT_WIKIPEDIA_REVISION,
  fetchImpl: typeof fetch = fetch,
  expectedSignNumbers: Iterable<string> = []
): Promise<WikipediaSignImport> {
  const url = new URL("https://he.wikipedia.org/w/api.php");
  url.searchParams.set("action", "parse");
  url.searchParams.set("oldid", String(revisionId));
  url.searchParams.set("prop", "wikitext|revid|sha1");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  const response = await fetchImpl(url, { headers: { "user-agent": "easy-in-theory-content-importer/1.0" } });
  if (!response.ok) throw new Error(`Wikipedia request failed: ${response.status} ${response.statusText}`);
  const payload = await response.json() as { parse?: { revid?: number; sha1?: string; wikitext?: string } };
  const wikitext = payload.parse?.wikitext;
  const actualRevision = payload.parse?.revid;
  if (!wikitext || actualRevision !== revisionId) throw new Error(`Wikipedia did not return requested revision ${revisionId}`);
  const parsed = parseWikipediaSignWikitext(wikitext);
  return {
    sourceUrl: permanentWikipediaUrl(revisionId),
    revisionId,
    sourceSha1: payload.parse.sha1 ?? null,
    snapshotSha256: createHash("sha256").update(wikitext).digest("hex"),
    ...parsed,
    missingExpectedSignNumbers: missingExpectedSignNumbers(parsed.signs, expectedSignNumbers),
  };
}

function signNumbersFromSeed(source: string): string[] {
  return [...source.matchAll(/\(gen_random_uuid\(\),\s*'([^']+)'/g)].map((match) => match[1]);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let revision = DEFAULT_WIKIPEDIA_REVISION;
  let output: string | undefined;
  let sawRevision = false;
  let sawOutput = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    if (arg === "--revision") {
      if (sawRevision || value === undefined) throw new Error("usage: pnpm content:import-signs [--revision <id>] [--output <file>]");
      revision = Number(value);
      sawRevision = true;
      index += 1;
    } else if (arg === "--output") {
      if (sawOutput || !value) throw new Error("usage: pnpm content:import-signs [--revision <id>] [--output <file>]");
      output = value;
      sawOutput = true;
      index += 1;
    } else {
      throw new Error("usage: pnpm content:import-signs [--revision <id>] [--output <file>]");
    }
  }
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error("usage: pnpm content:import-signs [--revision <id>] [--output <file>]");
  }
  const imported = await fetchWikipediaSignImport(
    revision,
    fetch,
    signNumbersFromSeed(readFileSync("seeds/signs.sql", "utf8"))
  );
  if (output) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(imported, null, 2)}\n`);
  }
  console.log(JSON.stringify({
    revisionId: imported.revisionId,
    sourceUrl: imported.sourceUrl,
    snapshotSha256: imported.snapshotSha256,
    signs: imported.signs.length,
    duplicateSignNumbers: imported.duplicateSignNumbers,
    missingExpectedSignNumbers: imported.missingExpectedSignNumbers,
    unclassifiedSignNumbers: imported.unclassifiedSignNumbers,
  }, null, 2));
  if (imported.duplicateSignNumbers.length || imported.missingExpectedSignNumbers.length || imported.unclassifiedSignNumbers.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(`content:import-signs - ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
