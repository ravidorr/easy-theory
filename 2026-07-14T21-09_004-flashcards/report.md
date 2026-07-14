# QA report: Sign flashcards

Run: `2026-07-14T21-09_004-flashcards`

Charter: `qa/charters/004-flashcards.md`

## Environment

- Git SHA: `cd095d1a60cee1421a6faac16f49b51a18218cff`
- App version: `0.3.130`
- Base URL: `http://localhost:3100`
- Viewport: `390x844`
- Locale: `he`
- Supabase host: `nvgqczaesfeotijjcbed.supabase.co`
- Started: `2026-07-14T21:09:00Z`
- Finished: `2026-07-14T21:15:00Z`

## Verdict summary

7/9 pass, 2 fail (1 question finding, 1 minor a11y finding), 0 blocked, 0 not-checked.

## Checks

| Check | Verdict | Observed | Evidence |
| --- | --- | --- | --- |
| CHK-FC-01 | pass | 277-card deck loaded with sign image and count text. | [screenshot](screenshots/step-02-first-card-front.png), [dom](step-02-flashcards-dom.json) |
| CHK-FC-02 | pass | Card flip revealed matching name and badge on back. | [flipped](screenshots/step-03-card-flipped.png) |
| CHK-FC-03 | pass | Know/don't-know advanced deck and progress without NaN. | [replay dom](step-04-replay-dom.json) |
| CHK-FC-04 | pass | Three don't-know cards replayed after first pass. | [replay](screenshots/step-04-mid-pass.png), [dom](step-04-replay-dom.json) |
| CHK-FC-05 | fail | 277 POST /api/srs while marking cards. | [network](network.log) |
| CHK-FC-06 | pass | Sampled images rendered with alt text, no broken icon. | [screenshot](screenshots/step-02-first-card-front.png) |
| CHK-CONSOLE-01 | pass | Zero console errors; warnings only. | [console](console.log) |
| CHK-A11Y-01 | fail | Flip wrap lacks role/name; no page heading. | [screenshot](screenshots/step-02-first-card-front.png) |
| CHK-COPY-RTL-01 | pass | Hebrew copy from he.json; RTL intact. | [dom](step-02-flashcards-dom.json) |

## F-001: Flashcard grading POSTs to /api/srs

- Severity: question
- Confidence: high
- Category: network
- Related checks: CHK-FC-05

Reproduction:

1. Open authenticated /he/flashcards.
2. Mark cards with ידעתי or עוד לא.
3. Watch network traffic.

Expected: No /api/ requests during flip/mark (charter oracle).

Actual: Each graded card POSTed /api/srs (277 requests during deck run).

Evidence: [network log](network.log), [replay dom](step-04-replay-dom.json).

## F-002: Flashcard flip target lacks accessible name and role

- Severity: minor
- Confidence: high
- Category: a11y
- Related check: CHK-A11Y-01

Reproduction:

1. Open /he/flashcards.
2. Inspect .flashcard-wrap in the accessibility tree.

Expected: Flip control has role and accessible name.

Actual: Bare div with click handler only; no role or aria-label.

Evidence: [screenshot](screenshots/step-02-first-card-front.png).

## NOT tested

- Completing all 277 cards manually
- Sign quiz images (001)
- Arabic locale (007)
- Offline sign images (011)
- Desktop viewport
- Deck-complete screen
- Forced broken-image 404 fallback

## Known issues observed

None declared in charter.

## Limitations

- Existing browser session before mint.
- Scripted deck advancement for bounded replay proof.
- Many /api/srs requests still pending when network log captured.

## Next charter suggestions

- Reconcile charter CHK-FC-05 with SRS persistence intent.
- Add button role/aria-label to flashcard flip target.
