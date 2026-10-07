# Security Policy Version Enforcement Design

## Goal

Prevent a package release from declaring a version in `package.json` that is
not declared as supported in `SECURITY.md`.

## Scope

`SECURITY.md` will name the exact current release, beginning with `0.58.4`, in
its supported-versions table. A version bump must update that value in the same
change.

The supported-status symbol is an intentional exception to the repository's
no-emoji convention. The validator will represent it by Unicode code point
`U+2713`, avoiding an emoji literal in executable code.

A reusable Node validation script will:

1. Read the stable SemVer version from `package.json`.
2. Read the supported-version entry in `SECURITY.md`.
3. Require an enabled row containing the exact package version.
4. Exit non-zero with an actionable error when the policy is missing, malformed,
   unsupported, or has a different version.

The check will run in both the existing pre-push hook and pull-request CI.

## Components

- `scripts/validate-security-policy-version.mjs`: Single source of validation
  logic. It will accept optional file paths for isolated tests.
- `.husky/pre-push`: Invokes the validator after the existing SemVer and
  changelog checks, blocking pushes with an inconsistent release policy.
- `.github/workflows/security-policy-version.yml`: Runs the validator for pull
  requests using a clean checkout, protecting against missing local hooks.
- A colocated Vitest suite: Covers matching, version mismatch, absent policy,
  missing supported row, and an unsupported row.

## Error Handling

The validator will distinguish malformed policy content from a version
mismatch. Its failure message will state the detected package version and
instruct the contributor to add or update the enabled `SECURITY.md` table row.

## Verification

1. Run the validator with the repository files and confirm it passes.
2. Run the validator against each test fixture and verify failure messages.
3. Run the unit-test suite containing the validator tests.
4. Run the Markdown linter for the updated policy.
5. Confirm a pull request executes the new workflow.

## Non-Goals

- Inferring supported versions from changelog history or Git tags.
- Validating external GitHub security settings.
- Automating releases or version increments.
