# TODO

## 1. Audit remaining `src/lib/db.ts` helpers that swallow Supabase errors

- Most helpers destructure only `data` and return `data ?? []` (or a default), so a failed query is indistinguishable from an empty result — the same pattern that hid the review-page mistakes bug fixed in `getMistakesForTopic`.
- Decide per helper whether to throw (like `getMistakesForTopic` now does, surfaced by `src/app/[locale]/error.tsx`) or keep the soft fallback where an empty state is genuinely acceptable.

## 2. Bubbled `notFound()` never reaches `global-not-found` (Next 16.3.0-preview.5)

- `notFound()` thrown by the `[locale]` layout's invalid-locale guard (e.g. `/signs/nope`, where `signs` matches the `[locale]` segment) renders Next's built-in unbranded "404: This page could not be found" shell instead of `src/app/global-not-found.tsx` — verified against a production build, and identical before the 404-localization change (pre-existing).
- Since `[locale]/[...rest]` catches nearly every path, this bubbled path is how locale-less 404s actually resolve today; `global-not-found` only renders for URLs matching no route at all. Re-test after upgrading Next (experimental `globalNotFound`), or restructure so invalid locales 404 at the page level instead of the layout.
