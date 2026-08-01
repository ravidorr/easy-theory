import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { validateHistoricalSemver } from "../validate-changelog-semver-history.mjs";

describe("validateHistoricalSemver", () => {
  it("accepts patch and minor increments inferred from changelog categories", () => {
    const changelog = `## [0.3.1]\n\n### Fixed\n\n---\n\n## [0.3.0]\n\n### Added\n\n---\n\n## [0.2.1]\n\n### Fixed\n\n---\n\n## [0.2.0]\n\n### Added\n\n---\n\n## [0.1.0]\n\n### Added\n`;

    expect(validateHistoricalSemver(changelog)).toEqual([]);
  });

  it("reports a release whose inferred increment is wrong", () => {
    const changelog = `## [0.2.1]\n\n### Added\n\n---\n\n## [0.1.0]\n\n### Added\n`;

    expect(validateHistoricalSemver(changelog)).toEqual(["Expected 0.2.0, found 0.2.1."]);
  });

  it("keeps test-only additions in the patch line", () => {
    const changelog = `## [0.2.1]\n\n### Changed\n\n### Added\n- \`quiz-script.test.ts\` \u2014 6 DOM-fixture tests exercising the real \`public/js/quiz.js\` scoring and feedback behavior, plus reward-banner render assertions in the quiz and retry page tests\n\n---\n\n## [0.2.0]\n\n### Added\n- Added learner-facing progress\n\n---\n\n## [0.1.0]\n\n### Added\n`;

    expect(validateHistoricalSemver(changelog)).toEqual([]);
  });

  it("accepts the repository changelog", () => {
    expect(validateHistoricalSemver(readFileSync("CHANGELOG.md", "utf8"))).toEqual([]);
  });
});
