# IELTS Mock Test Platform

Computer-delivered IELTS Academic practice and mock tests, plus a marketing site,
for Davronbek Nabiev.

- **Stack**: Next.js 16 (App Router) · TypeScript · Tailwind v4 · PostgreSQL · Prisma 7
- **Deploy target**: single VPS (Docker Compose + nginx)
- **Module**: Academic only

## Getting started

You need Node 20+ and a local PostgreSQL.

```bash
npm install
```

Copy the env template and fill it in:

```bash
cp .env.example .env
```

`DATABASE_URL` currently holds a `CHANGEME` placeholder. Set your local Postgres
password, create the database, then run the first migration:

```bash
createdb -U postgres ielts_dev
```

```bash
npx prisma migrate dev --name init
```

Then start the dev server:

```bash
npm run dev
```

Seed an admin account and load the converted tests:

```bash
npm run db:seed
```

## What works today

The home page, then: sign up → browse tests → choose practice or mock → sit the
test → submit → see your score, band and per-question review → find it again on
your dashboard.

All four skills are playable, they compose into a full mock, and the instructor
has an admin panel to mark, publish and grant premium from. The only thing
outstanding is Uzbek and Russian **copy** — the dictionaries are wired and
waiting for the instructor's own words. See `docs/ROADMAP.md`.

### Images to add

Drop these into `public/` and they replace their placeholders automatically —
no code change needed:

- `instructor.png` (or `.webp`/`.jpg`) — the hero photo, cut out on a
  transparent or white background, portrait, roughly 4:5
- `logo.png` (or `.svg`) — the DN monogram, square

Marketing copy lives in `src/content/locales/`, one dictionary per language.
English is the reference; every other locale is merged over it key by key, so a
half-finished translation renders in English rather than blank. `uz.ts` and
`ru.ts` are empty on purpose — see the roadmap. The showcase results and
testimonials on the home page are placeholder rows from the seed; replace them
with real students.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run dev:clean` | Dev server after deleting `.next` — see "When routes 404" |
| `npm test` | Unit tests (grader, validator, band tables, password hashing) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run convert` | Converts `_source-tests/*.html` into validated JSON in `content/tests/` |
| `npm run audio:upload` | Stores a listening test's audio and attaches it (see Media storage) |
| `npm run db:migrate` | Prisma migration |
| `npm run db:studio` | Browse the database |

## When routes 404 for no reason

If an API route starts returning **404 with an HTML body** — a submit that fails
with "Could not submit", listening audio that reports "Audio unavailable", a
full mock that will not start — the route is almost certainly fine and the dev
server's route manifest is stale.

```bash
npm run dev:clean
```

The tell is the response body: a real handler answers with JSON, so an HTML 404
means Next never registered the route at all. Confirm with `npm run build`,
which compiles from scratch — it will list every route correctly while the dev
server is still serving 404s.

It happens most often after **running `next build` while `next dev` is
running**, and after files move (a `git mv`, switching branches, pulling a
change that adds routes). Restarting `next dev` on its own is not enough,
because the stale output survives in `.next`.

## How a test is stored

Each test is two JSON documents, deliberately kept apart:

- **`content`** — passages, rubrics, question groups. Sent to the browser.
- **`answerKey`** — accepted answers, explanations, evidence anchors. **Server only.**
  Grading happens in an API route; the browser never receives the answers.

Question bodies are HTML with `{{n}}` slot markers rather than fully structured
data, because real IELTS layouts (tables, forms, flow-charts) carry meaning in
their shape. The slot markers tie that HTML back to question numbers.

Group types cover the standard question formats: `completion`, `short_answer`,
`mcq`, `tfng`, `ynng`, `matching`, and `map_labeling`. See `src/lib/tests/schema.ts`.

## Adding a test

The intended flow is: convert a PDF to JSON with an LLM, paste it into admin,
fix what the validator flags, preview it in the real player, publish.

Pasted JSON is treated as untrusted. `validateTestImport()` enforces:

- every question number 1..N appears exactly once in the content, and once in the key
- answer letters exist among that question's options or word bank
- True/False and Yes/No answers are one of the three legal values, and typed
  answers are not (this is what catches a key whose entries have shifted)
- accepted answers respect the rubric's own word limit
- reading answers marked "from the passage" actually occur in it (warning)
- a **self-test**: the key's own answers are graded by the real grader and must
  score full marks

That last check catches structural disagreement between content and key. It
cannot catch a key that is internally consistent but semantically wrong, since
it grades the key against itself — the type checks above are what catch that.

## Writing and speaking

Neither is auto-graded, and that shapes everything downstream. Submitting one
leaves `Attempt.band` **null**, which is the single signal the rest of the app
reads: the dashboard shows "awaiting marking", excludes the attempt from band
history and from best-by-skill, and the results page explains why there is no
number yet. A zero would have been easier and would have quietly dragged down
every average.

Writing text rides the existing autosave endpoint, keyed by task number in the
attempt's `answers` map, and is copied into its own `WritingSubmission` row on
submit so the instructor's queue can be a plain query.

Speaking answers are recorded with `MediaRecorder` and uploaded **one prompt at
a time**, so a crash halfway through a test costs one answer rather than the
sitting. Re-recording in practice replaces the previous take, file and row
together. A mock allows no second take and no listening back before the end.

When the admin panel lands, marking must set **both** `WritingSubmission.
instructorBand` and `Attempt.band` — the first is the instructor's record, the
second is what the dashboard reads.

## The full mock

One test per skill, sat back to back. The composition is decided once, at the
start, and written as real `Attempt` rows with a `sequence` — picking lazily
would let the set change under a student who paused overnight.

`src/lib/full-mock/select.ts` holds the choosing rules and imports no database,
so they can be tested directly. In priority order: a full-length section the
student has not sat, then the full-length one they sat longest ago, then
anything unsat, then whatever is oldest. **Section length outranks freshness** —
the library holds a 13-question reading passage and a single-task writing
practice, and a "full mock" built from those reports a band the student cannot
reproduce on the day.

Each section is untimed until it is opened; the clock starts on the first
`POST /api/full-mocks/[id]/start` and reopening keeps the original deadline, so
a reload cannot buy time. Submitting a section returns the student to the mock
rather than into review — nobody should read explanations with the next clock
about to start.

The overall band is only written once every section has one. Writing and
speaking wait on the instructor, so a mock can complete today and gain its
overall a week later; averaging early would publish a number that then changes.

## Admin

`/admin`, guarded by role. Every server action re-checks the caller: an action
is a public endpoint with a generated name, and being unreachable from the UI is
not access control.

- **Marking** — the queue that unblocks writing and speaking bands. Recording a
  band writes `WritingSubmission.instructorBand` *and* `Attempt.band`; the first
  is the marker's record, the second is what every student screen reads.
  Speaking has no submission row, so its feedback rides in `Attempt.result`.
- **Answer reviews** — typed answers the grader rejected, grouped by how many
  students gave them. Accepting one writes the variant into the test's answer
  key for future sittings. Attempts already marked are deliberately left alone:
  silently changing a band a student has seen is worse than the original miss.
- **Tests** — grouped by skill and filterable, with a preview link into the real
  player. JSON import (file picker, drag-drop or paste) runs the same validator
  as the conversion scripts, and the title, web address and premium flag are
  editable on the form rather than buried in the file.

  The screen leads with a **ready-made prompt per skill**
  (`src/lib/admin/import-prompts.ts`): the instructor copies one, hands it to any
  AI model with the PDF or an old HTML test, and pastes the reply back. Each
  prompt states every rule the validator enforces and carries a complete worked
  example, because a model given only a schema invents plausible key names that
  fail on import. Those examples are unit tested against the real validator — a
  prompt whose own example does not import is worse than no prompt.

  Charts, maps and process diagrams are **not** part of the imported JSON. A
  model reading a PDF cannot produce one, so the tests page shows an upload slot
  for each Academic Task 1 and map-labelling group, and refuses to publish until
  they are filled. Imports always land as drafts.
- **Students** — premium grants, with a note recording why.

## Converting the legacy HTML mocks

`_source-tests/` holds the instructor's existing self-contained HTML tests. Each
has its own adapter under `scripts/convert/`, sharing one cleaning and
validation pipeline. `npm run convert` writes validated JSON to `content/tests/`.

The five adapters cover three quite different source shapes: markup with the
key in inline objects (Cambridge), a player that stores its questions as data
and renders them at runtime (`safarov-listening`), and hand-written markup where
each group's type has to be inferred from the controls used (`mock-listening`).

Word limits are read from the rubric by `maxWordsFromRubric`. Its phrase list is
duplicated in `src/lib/tests/validate.ts`; keep the two in step, and note that
"AND/OR A NUMBER" phrasings must be matched before the plainer ones they contain
or the limit comes out one token short.

Answer keys inside those files are JavaScript object literals, not JSON. They are
read with a small hand-written parser rather than `eval` or `node:vm`, because
the source HTML is downloaded from third parties and must never be executed.

Listening audio in the source files is hot-linked from archive.org. The converter
records the URL as `audioSourceUrl` so it gets re-hosted; a listening test cannot
be published without an uploaded audio file.

The writing and speaking tests have no adapter: they come from the official IELTS
sample PDFs in `_source-tests/`, hand-authored into `content/tests/` the way the
"Adding a test" flow above describes. Task 1 charts were extracted from the PDF
into `public/test-media/`. Writing one converter per PDF would have been more
code than reading three prompts.

## Media storage

Listening audio and speaking recordings live in `MEDIA_STORAGE_DIR`, outside the
web root. They are streamed through `/api/tests/[id]/audio`, which applies the
same gate as sitting the test, then handed to nginx via `X-Accel-Redirect` in
production. Nothing is served from `public/`.

### Uploading audio

```bash
npm run audio:upload -- --list
npm run audio:upload -- --test <slug> --file "_source-tests/Listening Mock.mp3" --publish
npm run audio:upload -- --test <slug> --from-source --publish
```

`--from-source` downloads the `audioSourceUrl` the converter recorded. `--publish`
flips the test out of draft, which is the only way a listening test becomes
visible to students.

The script is safe to re-run: the storage key ends in a hash of the file, so the
same audio lands on the same key, and a replaced file has its predecessor deleted
once nothing points at it.

Files are typed by their **first bytes, not their extension** — one of the
instructor's mocks is an M4A named `.mp3`, and serving that as `audio/mpeg`
alongside the route's `nosniff` header makes it silently unplayable. Duration is
read from the Xing/Info header (MP3) or the `mvhd` box (MP4), with no ffmpeg
dependency; it is only a convenience, and null when it cannot be parsed.

### nginx

The route sends `X-Accel-Redirect` only when `MEDIA_INTERNAL_PREFIX` is set;
leave it empty in development and Node streams the file itself, range requests
included. In production:

```nginx
location /protected-media/ {
    internal;
    alias /var/lib/ielts/media/;
}
```

with `MEDIA_INTERNAL_PREFIX="protected-media"` and `MEDIA_STORAGE_DIR` pointing
at the same directory. The route still runs, so authentication and the premium
check are enforced on every request; only the bytes are handed off.

## Project layout

```
prisma/schema.prisma      database schema
src/lib/tests/            content schema, grader, band tables, validator, access
src/lib/auth/             scrypt passwords, DB-backed sessions, guards, rate limiting
src/lib/attempts/         grading, storage, unrecognized-answer queue
src/lib/media/            file storage, range parsing, audio probing, video links
src/lib/full-mock/        composition rules (select.ts) and lifecycle (service.ts)
src/app/admin/            instructor panel: marking, reviews, tests, students
src/components/player/    the CD test player, plus the writing and speaking players
src/app/api/              auth, attempt and audio streaming routes
src/app/                  login, signup, dashboard, tests, attempt, results
scripts/convert/          HTML to JSON adapters
scripts/seed.ts           admin user, tests, sample homepage content
scripts/upload-audio.ts   stores listening audio and publishes the test
content/tests/            converted, validated tests
_source-tests/            original HTML sources
```

## Notes on the player

The timer measures against the server's deadline instead of counting down
locally, so a backgrounded tab cannot drift, and the deadline is enforced again
on submit. Answers autosave on a debounce; a submission arriving after the
deadline keeps everything saved before it, so running out of time never costs a
student marks they had already earned.

Submitting does not navigate away. The review panel opens in place, with the
passage still beside the questions — that is the point of reviewing.

Writing and speaking can be **finished without being sent** to the instructor,
and sending is premium-only — `Attempt.reviewRequested` is what the marking
queue filters on, so a free student can practise without filling it with work
nobody asked to have marked. Speaking answers can be skipped: practice is not
the exam, and a student should be able to read a Part 3 question, decide it is
not the one they want to rehearse, and move on.

Students can highlight the reading passage and attach a note to a highlight, and
tests with no passage get a floating notepad instead — listening needs one,
because answers arrive faster than they can be typed into the boxes. Both ride
the `annotations` column and the existing autosave, so neither needed a
migration or an API change.

A highlight is stored as a character range over the passage's **text**, which
survives a re-render, a font-size change and a review-mode evidence mark. The
marks are woven into the HTML string before it is parsed rather than wrapped
into the DOM afterwards: mutating React-owned nodes is what makes this kind of
feature crash on the next render, and the passage HTML is not sanitised, so
switching to `dangerouslySetInnerHTML` for an opaque subtree would have traded a
rendering bug for an injection one. See `src/lib/player/highlights.ts`.

Listening tests get an audio bar under the header. In a mock it enforces the
exam: one press, no pause control, no seeking, no replay once it has finished.
Seeking is blocked at the element, not just hidden, so media keys and devtools
snap back to the last legitimate position. Practice and review hand back full
transport, because there the recording is the thing being studied.

The bar will not let a student start until roughly fifteen seconds are buffered,
so a slow connection stalls before the test rather than during it. Play-once is
enforced for the life of the page: reloading mid-attempt currently rearms the
recording, which needs attempt-level state to fix properly.
