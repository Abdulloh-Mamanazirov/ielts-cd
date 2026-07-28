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

- **Writing and speaking** — both players built, and four tests authored from
  the official sample PDFs (3 writing, 1 speaking). Neither is auto-graded:
  submitting leaves `Attempt.band` null, which is what the dashboard reads to
  show "awaiting marking" and to keep an unmarked attempt out of band history.
  Speaking answers upload one prompt at a time.

## Next, in priority order

### 1. Admin panel

Nothing exists yet. Without it the instructor cannot add tests, upload audio,
grant premium, review writing, or manage the homepage content — all of which are
currently script only. Needed before handover. The audio upload form should wrap
`scripts/upload-audio.ts`, whose ingest step already does the hard parts
(content-addressed keys, container sniffing, superseded-file cleanup).

Marking writing and speaking is the most urgent part: students can sit both
today, and nothing can give them a band. Marking must write **both**
`WritingSubmission.instructorBand` and `Attempt.band` — the first is the
instructor's record, the second is what the dashboard reads.

### 2. Full mock

Composition of one test per skill. All four players exist now, so what is left is
the composition itself: four attempts under one clock, an overall band across
them, and a resume path. Still "Coming soon" in the UI.

### 3. Uzbek and Russian

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
- The speaking recorder has **not** been exercised against a real microphone.
  Everything around it has — the briefing, the permission-denied path, upload,
  supersede, playback with ranges, validation rejections — but the tooling used
  to verify it blocks device capture, so `MediaRecorder` itself was never run.
  Sit one speaking test in a real browser before handover.
- Speaking has no per-answer retake limit in practice, and no cap on how many
  times a student re-records. Fine for practice; worth a thought if speaking
  ever counts towards anything.
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
