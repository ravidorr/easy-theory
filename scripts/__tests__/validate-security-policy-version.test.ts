import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  validateSecurityPolicyFiles,
  validateSecurityPolicyVersion,
} from "../validate-security-policy-version.mjs";

const packageJson = '{"version":"0.58.3"}';
const supportedStatus = String.fromCodePoint(0x2713);
const supportedPolicy = `## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.58.3 | ${supportedStatus} |`;

describe("validateSecurityPolicyVersion", () => {
  it("accepts an enabled row for the exact package version", () => {
    expect(validateSecurityPolicyVersion(packageJson, supportedPolicy)).toEqual({
      valid: true,
      version: "0.58.3",
    });
  });

  it("rejects a policy that supports a different release", () => {
    expect(
      validateSecurityPolicyVersion(
        packageJson,
        supportedPolicy.replace("0.58.3", "0.58.2"),
      ),
    ).toEqual({
      valid: false,
      error:
        "SECURITY.md supports 0.58.2, but package.json declares 0.58.3. Update SECURITY.md.",
    });
  });

  it("rejects a policy without an enabled supported-version row", () => {
    expect(
      validateSecurityPolicyVersion(
        packageJson,
        supportedPolicy
          .replace("0.58.3", "0.58.2")
          .replace(supportedStatus, "not-supported"),
      ),
    ).toEqual({
      valid: false,
      error: "SECURITY.md has no enabled supported-version row.",
    });
  });

  it("rejects an unsupported matching release", () => {
    expect(
      validateSecurityPolicyVersion(
        packageJson,
        supportedPolicy.replace(supportedStatus, "not-supported"),
      ),
    ).toEqual({
      valid: false,
      error:
        "SECURITY.md declares 0.58.3 as unsupported. Mark the package version as supported.",
    });
  });

  it("rejects a policy without a supported-versions table", () => {
    expect(validateSecurityPolicyVersion(packageJson, "# Security Policy")).toEqual({
      valid: false,
      error: "SECURITY.md is missing a supported-versions table.",
    });
  });

  it("uses the table in the supported-versions section", () => {
    const policyWithExampleTable = `## Example

| Version | Supported |
| ------- | --------- |
| 0.58.2 | ${supportedStatus} |

${supportedPolicy}`;

    expect(
      validateSecurityPolicyVersion(packageJson, policyWithExampleTable),
    ).toEqual({
      valid: true,
      version: "0.58.3",
    });
  });

  it("ignores a supported-versions table in a fenced code example", () => {
    const policyWithFencedExampleTable = `\`\`\`markdown
## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.58.2 | ${supportedStatus} |
\`\`\`

${supportedPolicy}`;

    expect(
      validateSecurityPolicyVersion(packageJson, policyWithFencedExampleTable),
    ).toEqual({
      valid: true,
      version: "0.58.3",
    });
  });

  it("rejects version rows that are not part of the supported-versions table", () => {
    const malformedPolicy = `## Supported Versions

| Version | Supported |
This is not a table delimiter.
| 0.58.3 | ${supportedStatus} |`;

    expect(validateSecurityPolicyVersion(packageJson, malformedPolicy)).toEqual({
      valid: false,
      error: "SECURITY.md is missing a supported-versions table.",
    });
  });

  it("rejects an invalid package version", () => {
    expect(
      validateSecurityPolicyVersion(
        '{"version":"0.58.3-beta.1"}',
        supportedPolicy,
      ),
    ).toEqual({
      valid: false,
      error: "package.json must contain an exact stable SemVer version.",
    });
  });

  it("reads package and policy content from supplied paths", () => {
    const directory = mkdtempSync(join(tmpdir(), "easy-theory-security-"));
    const packageJsonPath = join(directory, "package.json");
    const securityPolicyPath = join(directory, "SECURITY.md");

    try {
      writeFileSync(packageJsonPath, packageJson);
      writeFileSync(securityPolicyPath, supportedPolicy);

      expect(
        validateSecurityPolicyFiles(packageJsonPath, securityPolicyPath),
      ).toEqual({ valid: true, version: "0.58.3" });

      expect(
        execFileSync(
          process.execPath,
          [
            "scripts/validate-security-policy-version.mjs",
            packageJsonPath,
            securityPolicyPath,
          ],
          { encoding: "utf8" },
        ),
      ).toBe("SECURITY.md supports package version 0.58.3.\n");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("reports a missing policy file", () => {
    expect(
      validateSecurityPolicyFiles("package.json", "missing-security-policy.md"),
    ).toMatchObject({
      valid: false,
      error: expect.stringContaining("Unable to read security policy files:"),
    });
  });
});
