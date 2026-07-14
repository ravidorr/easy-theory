# TODO

## 1. Bubbled `notFound()` never reaches `global-not-found` (Next 16.3.0-preview.5)

- `notFound()` thrown by the `[locale]` layout's invalid-locale guard (e.g. `/signs/nope`, where `signs` matches the `[locale]` segment) renders Next's built-in unbranded "404: This page could not be found" shell instead of `src/app/global-not-found.tsx` — verified against a production build, and identical before the 404-localization change (pre-existing).
- Since `[locale]/[...rest]` catches nearly every path, this bubbled path is how locale-less 404s actually resolve today; `global-not-found` only renders for URLs matching no route at all. Re-test after upgrading Next (experimental `globalNotFound`), or restructure so invalid locales 404 at the page level instead of the layout.
