import { execFileSync } from "node:child_process";

const RELEASE = /^## \[(\d+\.\d+\.\d+)\]/gm;

export function missingReleaseHeadings(baseChangelog, pushedChangelog) {
  const pushed = new Set([...pushedChangelog.matchAll(RELEASE)].map((match) => match[1]));

  return [...baseChangelog.matchAll(RELEASE)]
    .map((match) => match[1])
    .filter((version) => !pushed.has(version));
}

if (process.argv.length === 4) {
  const [, , base, pushed] = process.argv;
  const baseChangelog = execFileSync("git", ["show", `${base}:CHANGELOG.md`], { encoding: "utf8" });
  const pushedChangelog = execFileSync("git", ["show", `${pushed}:CHANGELOG.md`], { encoding: "utf8" });
  const missing = missingReleaseHeadings(baseChangelog, pushedChangelog);

  if (missing.length > 0) {
    console.error(`Missing existing release heading(s): ${missing.join(", ")}.`);
    process.exit(1);
  }
}
