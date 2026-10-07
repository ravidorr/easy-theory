# Full Coverage Design

## Goal

Raise the configured Vitest V8 coverage metrics to 100% for statements, branches, functions, and lines without excluding application code, weakening thresholds, or changing production behavior.

## Scope

The baseline run passes 1,365 tests in 136 files and reports:

- Lines: 100% (1608/1608)
- Functions: 100% (414/414)
- Statements: 99.71% (1779/1784)
- Branches: 95.79% (1322/1380)

The work adds behavioral tests only. It does not alter `vitest.config.ts`, production code, coverage thresholds, or coverage exclusions.

## Test Design

Add targeted cases to the existing colocated test suites for each unvisited path:

1. Client instrumentation, proxy, navigation controls, and schedule nudge state guards.
2. Localized page fallbacks for missing display content, metadata locale variants, and absent data returned by backend helpers.
3. API validation and error-handling variants, including malformed input, null database results, and non-`Error` failures.
4. Shared component state guards and DOM-reuse behavior.
5. Gamification and database helper fallbacks for missing or null data.

All cases assert observable output, calls, navigation, or responses. Tests will reuse each suite's existing mocks and fixture conventions.

## Special Branch

`ScheduleNudge.tsx` defensively checks whether `document.activeElement` is an `HTMLElement`. Browsers normally guarantee that this is true, so JSDOM must narrowly mock this condition. The test will assert that focus restoration is skipped, proving the defensive branch does not throw. This is the only synthetic environment state required.

## Verification

1. Run the affected test suites while adding cases.
2. Run `pnpm test:coverage`.
3. Confirm all tests pass and all four aggregate coverage metrics report 100%.
4. Check modified test files for diagnostics.

## Non-Goals

- Excluding hard-to-reach code from coverage.
- Lowering coverage thresholds.
- Refactoring application code for coverage alone.
- Modifying dependencies or the package manager configuration.
