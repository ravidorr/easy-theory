import { describe, expect, it } from "vitest";

import { isSingleSemverIncrement, readStablePackageVersion } from "../validate-semver-bump.mjs";

describe("isSingleSemverIncrement", () => {
  it.each([
    ["0.3.252", "0.3.253"],
    ["0.3.252", "0.4.0"],
    ["0.3.252", "1.0.0"],
  ])("accepts %s to %s", (current, next) => {
    expect(isSingleSemverIncrement(current, next)).toBe(true);
  });

  it.each([
    ["0.3.252", "0.3.252"],
    ["0.3.252", "0.3.254"],
    ["0.3.252", "0.4.1"],
    ["0.3.252", "1.1.0"],
    ["0.3.252", "0.3.253-beta.1"],
    ["0.3.252", "invalid"],
  ])("rejects %s to %s", (current, next) => {
    expect(isSingleSemverIncrement(current, next)).toBe(false);
  });

  it.each([
    ['{"version":"0.3.253"}', "0.3.253"],
    ['{"version":"0.3.253-beta.1"}', null],
    ['{"version":"0.3.253+build.1"}', null],
    ['{"version":253}', null],
    ["not json", null],
  ])("reads only exact stable package versions", (packageJson, expected) => {
    expect(readStablePackageVersion(packageJson)).toBe(expected);
  });
});
