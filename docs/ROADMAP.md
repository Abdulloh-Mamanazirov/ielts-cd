# Build state and roadmap

Written 2026-07-28. Update this when a phase lands, so a new session can pick up
without re-deriving anything.

## Done

- **Engine** — canonical test JSON schema, grader (normalisation, accepted
  variants, select-two set semantics, rubric word limits), Academic band tables,
  and a validator that includes a self-test grading the answer key against
  itself. 38 unit tests.
- **Auth** — scrypt passwords, DB-backed sessions with hashed tokens, guards,
  login throttling.
- **Attempt lifecycle** — start/resume, debounced autosave, server-side grading,
  unrecognised-answer review queue.
- **Test player** — CD-style split view with draggable divider (32–68%), tabs
  below 900px, four-state navigator, depleting-rule timer, submit dialog,
  review mode with explanations and evidence highlighting.
- **Marketing site** — home page and `/results`, design direction 1a.
- **App screens** — navy sidebar with per-skill nav, dashboard with band
  history, test list with per-row state.
- **Content** — 5 tests converted and validated from `_source-tests/`
  (2 reading, 3 listening). Adapters in `scripts/convert/`.

## Next, in priority order

### 1. Listening audio (unblocks 3 tests)

Three listening tests are seeded as **drafts** and invisible to students purely
because they have no audio. Everything else about them works — all three grade
40/40 against their own keys.

The two MP3s are already on disk in `_source-tests/`:
`CD IELTS LIstening – Volume 9, Test 2 [@safarov_english].mp3` (37 MB) and
`Listening Mock.mp3` (55 MB). The third (Cambridge 21) still needs downloading
from the `audioSourceUrl` recorded on the test row.

Needs:
- `AudioAsset` rows + files under `MEDIA_STORAGE_DIR` (already in `.env`)
- An authenticated streaming route with range support, handing off to nginx via
  `X-Accel-Redirect` in production
- An upload path (script first, admin UI later)
- The player's audio bar: buffering gate, play once, no seeking in mock mode,
  volume. Not in the design file — build it consistent with the existing chrome.

### 2. Writing and speaking

`_source-tests/` holds `ielts-academic-writing-sample-tasks-2023_removed.pdf`
and `ielts-speaking-sample-tasks-2023.pdf` (ignore the speaking sample answers
and recordings inside it).

This is more than conversion — neither player exists yet:
- Writing: task prompt, editor with live word count, download, save to
  dashboard, instructor view in admin.
- Speaking: cue cards with prep/speak timers and an in-browser recorder.

### 3. Admin panel

Nothing exists yet. Without it the instructor cannot add tests, grant premium,
review writing, or manage the homepage content — all of which are currently
seed-script only. Needed before handover.

### 4. Full mock

Composition of one test per skill. Deliberately shown as "Coming soon" in the UI
because it cannot run until writing, speaking and listening audio all exist.

### 5. Uzbek and Russian

Copy is already isolated in `src/content/site.ts` so this is a swap to a
per-locale dictionary plus routing. Translations must come from the instructor;
do not invent them for a public-facing site.

## Known gaps worth remembering

- Instagram reels cannot have thumbnails derived (no public oEmbed without a
  token). `Testimonial.thumbnailUrl` exists for uploaded ones; YouTube posters
  are derived automatically.
- Showcase results and testimonials on the home page are placeholder seed rows.
- Contact details in `src/content/site.ts` came from a mockup image — confirm
  them before launch.
- `npm audit` reports advisories in dev-only transitive deps of eslint and
  Next's own pinned packages. Forcing them would downgrade real things.
