import { describe, expect, it } from "vitest";

import { missingReleaseHeadings } from "../validate-changelog-release-headings.mjs";

describe("missingReleaseHeadings", () => {
  const base = "## [0.3.252]\n\n### Changed\n";

  it("accepts a new heading inserted before the existing release", () => {
    const pushed = "## [0.3.253]\n\n### Fixed\n\n---\n\n## [0.3.252]\n\n### Changed\n";

    expect(missingReleaseHeadings(base, pushed)).toEqual([]);
  });

  it("rejects renaming the existing release heading", () => {
    const pushed = "## [0.3.253]\n\n### Changed\n";

    expect(missingReleaseHeadings(base, pushed)).toEqual(["0.3.252"]);
  });
});
