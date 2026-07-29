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

- **Full mock** — one test per skill, composed at the start and stored as real
  attempts with a sequence. Selection rules live in `src/lib/full-mock/select.ts`
  with no database import, so they are unit tested; section length outranks
  freshness, so a mock never uses the 13-question reading practice. Each
  section's clock starts when it is opened and cannot be reset by reloading. The
  overall band is written only once every section has one.
- **Admin panel** — `/admin`, role guarded, server actions that re-check the
  caller. Marking queue for writing and speaking (writes both
  `WritingSubmission.instructorBand` and `Attempt.band`), answer-review queue
  that can extend a test's key, JSON test import running the real validator,
  publish/archive controls that refuse to publish a listening test without
  audio, and premium grants.

- **Locale plumbing** — `src/content/locales/` holds one dictionary per
  language. English is the reference and every other locale is merged over it
  key by key, so a partial translation renders in English rather than blank.

- **Exam-shell pass** — the reading and listening screens were rebuilt to sit
  closer to the computer-delivered test after a review from outside. Options
  are a plain control-letter-text row rather than a card (`AnswerOption.tsx`);
  gap numbers sit inside the box, centred until answered; part instructions run
  full width above both panes; and the bottom bar opens only the part you are
  in, collapsing the rest to `Part N  x of y`. The band is now revealed in the
  middle of the screen on submit before the marked paper appears. Writing's
  task switcher moved to the bottom to match.

## Next, in priority order

### 1. Uzbek and Russian translations

**This is a content task, not a code one.** The dictionaries exist and are
wired; `uz.ts` and `ru.ts` are deliberately empty because the wording has to
come from the instructor. This is a public page carrying his name and his band
promises — a machine translation of his own sales copy costs him students.

To ship a language:

1. Fill in any subset of the sections in `src/content/locales/en.ts` inside
   `uz.ts` or `ru.ts`. Anything missing falls back to English.
2. Add the locale to `ACTIVE_LOCALES` in `src/content/locales/index.ts`.
3. Add locale routing and a switcher, and change `site.ts` to resolve the
   locale from the request instead of using the default.

Step 3 is the only remaining code, and it is deliberately not written yet:
publishing a `/ru` route that serves English is worse for a reader than not
offering Russian at all.

## Known gaps worth remembering

- The admin panel has no audio upload form; `npm run audio:upload` is still the
  way in, and the tests screen prints the exact command for a listening test
  that needs one. The script's ingest already does the hard parts
  (content-addressed keys, container sniffing, superseded-file cleanup), so the
  form is a wrapper around it rather than new logic.
- Homepage showcase results and testimonials are still seed rows with no admin
  screen. They are the last script-only content.
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
- The speaking "skip this question" control has not been exercised end to end,
  for the same reason as the recorder below: the pane used to verify blocks the
  microphone, so the briefing cannot be passed.
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
