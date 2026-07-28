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
  (2 reading, 3 listening). Adapters in `scripts/convert/`. All five are
  published.
- **Listening audio** — `src/lib/media/`: storage with path-traversal guards,
  range parsing, and container/duration probing. Authenticated streaming route
  at `/api/tests/[id]/audio` with 206/416 handling and an `X-Accel-Redirect`
  handoff. `npm run audio:upload` stores, attaches and publishes. Player audio
  bar with a buffering gate and mock-mode lockdown. All three listening tests
  now have audio and are published.

## Next, in priority order

### 1. Writing and speaking

`_source-tests/` holds `ielts-academic-writing-sample-tasks-2023_removed.pdf`
and `ielts-speaking-sample-tasks-2023.pdf` (ignore the speaking sample answers
and recordings inside it).

This is more than conversion — neither player exists yet:
- Writing: task prompt, editor with live word count, download, save to
  dashboard, instructor view in admin.
- Speaking: cue cards with prep/speak timers and an in-browser recorder.

### 2. Admin panel

Nothing exists yet. Without it the instructor cannot add tests, upload audio,
grant premium, review writing, or manage the homepage content — all of which are
currently script only. Needed before handover. The audio upload form should wrap
`scripts/upload-audio.ts`, whose ingest step already does the hard parts
(content-addressed keys, container sniffing, superseded-file cleanup).

### 3. Full mock

Composition of one test per skill. Deliberately shown as "Coming soon" in the UI
because it cannot run until writing and speaking exist.

### 4. Uzbek and Russian

Copy is already isolated in `src/content/site.ts` so this is a swap to a
per-locale dictionary plus routing. Translations must come from the instructor;
do not invent them for a public-facing site.

## Known gaps worth remembering

- Mock-mode play-once holds for the life of the page. Reloading mid-attempt
  rearms the recording, because nothing about audio position is persisted.
  Fixing it properly means attempt-level state (a column, or a key inside
  `Attempt.annotations`) written when playback starts and read on resume.
- The audio bar hides the pause control in a mock and blocks seeking at the
  element, but does not force playback to resume if something else pauses it —
  the OS, media keys, devtools. Deliberate: the server-authoritative timer keeps
  running either way, so pausing costs a student clock rather than winning them
  a re-listen, and force-resuming would fight a student whose headphones just
  came out.
- `X-Accel-Redirect` is written but has only been exercised with
  `MEDIA_INTERNAL_PREFIX` empty, which is the Node-streaming path. The nginx
  handoff needs verifying on the real server; the README has the `location`
  block it expects.
- `_source-tests/Listening Mock.mp3` is really an M4A. The uploader types files
  by their first bytes, so this is handled, but do not assume the extensions in
  that directory are honest.

- Instagram reels cannot have thumbnails derived (no public oEmbed without a
  token). `Testimonial.thumbnailUrl` exists for uploaded ones; YouTube posters
  are derived automatically.
- Showcase results and testimonials on the home page are placeholder seed rows.
- Contact details in `src/content/site.ts` came from a mockup image — confirm
  them before launch.
- `npm audit` reports advisories in dev-only transitive deps of eslint and
  Next's own pinned packages. Forcing them would downgrade real things.
