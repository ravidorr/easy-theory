# Security Policy Version Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block pushes and pull requests when `package.json` and
`SECURITY.md` do not declare the same supported release version.

**Architecture:** A small Node module will validate in-memory policy and
package content, then expose a file-based CLI for repository checks. The
pre-push hook and a dedicated pull-request workflow invoke the package script,
so local and CI checks use the same implementation.

**Tech Stack:** Node.js ESM, Vitest, Husky, GitHub Actions, Markdown.

## Global Constraints

- `SECURITY.md` must declare the exact package version in an enabled table row.
- The policy's supported-status symbol is an intentional no-emoji exception;
  validator code represents it as Unicode code point `U+2713`.
- Run the same validator in the pre-push hook and pull-request CI.
- Add behavior-focused Vitest coverage for every validator outcome.
- Do not create a Git commit unless the user explicitly requests one.
- Do not bypass hooks, linters, tests, or CI checks.

---

## File Structure

- Create `scripts/validate-security-policy-version.mjs`: Parses the exact stable
  package version and validates its `SECURITY.md` support row.
- Create `scripts/__tests__/validate-security-policy-version.test.ts`: Covers
  valid, missing, unsupported, malformed, and mismatched policies.
- Create `.github/workflows/security-policy-version.yml`: Runs the validator on
  every pull request.
- Modify `SECURITY.md`: Replaces the minor-series claim with exact `0.58.4`.
- Modify `package.json`: Adds the reusable validation command.
- Modify `.husky/pre-push`: Runs the command before the existing release
  validation completes.

### Task 1: Declare the exact currently supported release

**Files:**

- Modify: `SECURITY.md:8-11`

**Interfaces:**

- Produces: An enabled table row with the exact value `0.58.4` that the
  validator can match.

- [ ] **Step 1: Replace the supported-version table**

  Change the table to declare the current release exactly:

  ```markdown
  | Version                           | Supported          |
  | --------------------------------- | ------------------ |
  | 0.58.4                            | ✓                  |
  | Earlier releases                  | ✘                  |
  ```

- [ ] **Step 2: Run the Markdown linter**

  Run: `pnpm exec markdownlint-cli2 SECURITY.md`

  Expected: `Summary: 0 error(s)`.

### Task 2: Build and test the version validator

**Files:**

- Create: `scripts/validate-security-policy-version.mjs`
- Create: `scripts/__tests__/validate-security-policy-version.test.ts`

**Interfaces:**

- Consumes: A package JSON string and `SECURITY.md` string.
- Produces: `validateSecurityPolicyVersion(packageJson, securityPolicy)`, which
  returns `{ valid: true, version }` or `{ valid: false, error }`.
- Produces: `validateSecurityPolicyFiles(packageJsonPath, securityPolicyPath)`,
  which reads repository files and returns the same result.

- [ ] **Step 1: Write failing unit tests**

  Create `scripts/__tests__/validate-security-policy-version.test.ts`:

  ```ts
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
  const supportedPolicy = `| Version | Supported |
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

    it("rejects an invalid package version", () => {
      expect(validateSecurityPolicyVersion('{"version":"0.58.3-beta.1"}', supportedPolicy)).toEqual({
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
  ```

- [ ] **Step 2: Run the new test file to verify it fails**

  Run: `pnpm vitest run scripts/__tests__/validate-security-policy-version.test.ts`

  Expected: FAIL because `validate-security-policy-version.mjs` does not exist.

- [ ] **Step 3: Implement the validator**

  Create `scripts/validate-security-policy-version.mjs`:

  ```js
  import { readFileSync } from "node:fs";
  import { fileURLToPath } from "node:url";

  import { readStablePackageVersion } from "./validate-semver-bump.mjs";

  const SUPPORTED_STATUS = String.fromCodePoint(0x2713);
  const TABLE_HEADER = /^\|\s*Version\s*\|\s*Supported\s*\|\s*$/m;
  const VERSION_ROW = /^\|\s*([0-9]+\.[0-9]+\.[0-9]+)\s*\|\s*([^|]+?)\s*\|\s*$/gm;

  export function validateSecurityPolicyVersion(packageJson, securityPolicy) {
    const version = readStablePackageVersion(packageJson);

    if (!version) {
      return {
        valid: false,
        error: "package.json must contain an exact stable SemVer version.",
      };
    }

    if (!TABLE_HEADER.test(securityPolicy)) {
      return {
        valid: false,
        error: "SECURITY.md is missing a supported-versions table.",
      };
    }

    const rows = [...securityPolicy.matchAll(VERSION_ROW)];
    const matchingRow = rows.find(([, rowVersion]) => rowVersion === version);

  if (matchingRow?.[2].trim() === SUPPORTED_STATUS) {
      return { valid: true, version };
    }

    if (matchingRow) {
      return {
        valid: false,
        error: `SECURITY.md declares ${version} as unsupported. Mark the package version as supported.`,
      };
    }

    const supportedVersion = rows.find(([, , status]) => (
      status.trim() === SUPPORTED_STATUS
    ))?.[1];

    if (supportedVersion) {
      return {
        valid: false,
        error: `SECURITY.md supports ${supportedVersion}, but package.json declares ${version}. Update SECURITY.md.`,
      };
    }

    return {
      valid: false,
      error: "SECURITY.md has no enabled supported-version row.",
    };
  }

  export function validateSecurityPolicyFiles(
    packageJsonPath = "package.json",
    securityPolicyPath = "SECURITY.md",
  ) {
    try {
      return validateSecurityPolicyVersion(
        readFileSync(packageJsonPath, "utf8"),
        readFileSync(securityPolicyPath, "utf8"),
      );
    } catch (error) {
      return {
        valid: false,
        error: `Unable to read security policy files: ${error.message}`,
      };
    }
  }

  if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const result = validateSecurityPolicyFiles(...process.argv.slice(2));

    if (!result.valid) {
      console.error(result.error);
      process.exit(1);
    }

    process.stdout.write(`SECURITY.md supports package version ${result.version}.\n`);
  }
  ```

- [ ] **Step 4: Run the validator tests**

  Run: `pnpm vitest run scripts/__tests__/validate-security-policy-version.test.ts`

  Expected: PASS with eight passing tests.

### Task 3: Integrate the validator into local and CI gates

**Files:**

- Modify: `package.json:9-38`
- Modify: `.husky/pre-push:5-10`
- Create: `.github/workflows/security-policy-version.yml`

**Interfaces:**

- Consumes: `validateSecurityPolicyFiles()` through
  `pnpm validate:security-policy`.
- Produces: A non-zero exit code that blocks an inconsistent push or
  pull request.

- [ ] **Step 1: Add the package command**

  Add this script adjacent to the existing validation scripts in `package.json`:

  ```json
  "validate:security-policy": "node scripts/validate-security-policy-version.mjs"
  ```

- [ ] **Step 2: Run the command before adding hook integration**

  Run: `pnpm validate:security-policy`

  Expected: `SECURITY.md supports package version 0.58.4.`

- [ ] **Step 3: Add the pre-push gate**

  Insert this immediately after `MAIN_VERSION` is read in `.husky/pre-push`:

  ```sh
  pnpm validate:security-policy || exit 1
  ```

- [ ] **Step 4: Add pull-request CI**

  Create `.github/workflows/security-policy-version.yml`:

  ```yaml
  name: Security Policy Version

  on:
    pull_request:
      types: [opened, synchronize, reopened]

  permissions:
    contents: read

  jobs:
    validate:
      name: Validate supported security version
      runs-on: ubuntu-latest

      steps:
        - uses: actions/checkout@v5
        - uses: pnpm/action-setup@v5
          with:
            version: 10.12.1
        - uses: actions/setup-node@v5
          with:
            node-version: 22
        - run: pnpm validate:security-policy
  ```

- [ ] **Step 5: Verify the complete change**

  Run: `pnpm vitest run scripts/__tests__/validate-security-policy-version.test.ts && pnpm validate:security-policy && pnpm exec markdownlint-cli2 SECURITY.md docs/superpowers/specs/2026-10-07-security-policy-version-enforcement-design.md`

  Expected: All commands exit successfully.
