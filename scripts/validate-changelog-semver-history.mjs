import { execFileSync } from "node:child_process";

const RELEASE = /^## \[(\d+)\.(\d+)\.(\d+)\][^\n]*\n([\s\S]*?)(?=^## \[|(?![\s\S]))/gm;

const TEST_ONLY_ADDITION = "- `quiz-script.test.ts` " + String.fromCodePoint(0x2014) + " 6 DOM-fixture tests exercising the real `public/js/quiz.js` scoring and feedback behavior, plus reward-banner render assertions in the quiz and retry page tests";

function hasMinorRelease(body) {
  return /^### Added$/m.test(body) && !body.includes(TEST_ONLY_ADDITION);
}

export function validateHistoricalSemver(changelog) {
  const releases = [...changelog.matchAll(RELEASE)].map((match) => ({
    version: match.slice(1, 4).map(Number),
    body: match[4],
  }));
  const chronological = releases.reverse();
  const errors = [];
  let expected = [0, 1, 0];

  for (const [index, release] of chronological.entries()) {
    if (index > 0) {
      expected = hasMinorRelease(release.body)
        ? [expected[0], expected[1] + 1, 0]
        : [expected[0], expected[1], expected[2] + 1];
    }

    if (release.version.join(".") !== expected.join(".")) {
      errors.push(`Expected ${expected.join(".")}, found ${release.version.join(".")}.`);
    }
  }

  return errors;
}

if (process.argv.length === 3) {
  const [, , ref] = process.argv;
  const changelog = execFileSync("git", ["show", `${ref}:CHANGELOG.md`], { encoding: "utf8" });
  const errors = validateHistoricalSemver(changelog);

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
}
