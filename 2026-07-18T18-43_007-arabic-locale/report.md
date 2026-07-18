# QA run 2026-07-18T18-43_007-arabic-locale

Environment: local QA, app `0.3.183`, SHA `1112cea`, 390x844, Arabic.

8/10 pass, 1 fail (minor), 1 not checked.

| Check | Verdict | Observed | Evidence |
| --- | --- | --- | --- |
| CHK-AR-01 | pass | Authenticated Arabic pages had `lang=ar` and RTL direction. | [notes](evidence.md) |
| CHK-AR-02 | pass | Arabic chrome had no Hebrew leakage. | [notes](evidence.md) |
| CHK-AR-03 | pass | Arabic question and options rendered from the Arabic content. | [notes](evidence.md) |
| CHK-AR-04 | pass | Arabic flashcard name and controls rendered. | [notes](evidence.md) |
| CHK-AR-05 | pass | Arabic More page and return-language control rendered. | [notes](evidence.md) |
| CHK-AR-06 | not checked | Bare-root redirect was not repeated. | — |
| CHK-AR-07 | pass | Counters and date were Arabic-localized. | [notes](evidence.md) |
| CHK-CONSOLE-01 | fail | React script-tag error on locale switch. | [console](console.log) |
| CHK-A11Y-01 | pass | Named controls, headings, localized alt text, lang/dir present. | [notes](evidence.md) |
| CHK-COPY-RTL-01 | pass | No Hebrew leakage or RTL breakage observed. | [notes](evidence.md) |

## Finding F-001

Minor, high confidence. Switching Hebrew → Arabic logs a React error about a script tag rendered inside a component. It reproduced twice; the Arabic page still rendered.

## NOT tested

- Bare-root locale redirect.
- Arabic exam, schedule, review/retry.
