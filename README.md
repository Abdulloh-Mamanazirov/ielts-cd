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

Not built yet: the admin panel, listening audio playback and upload, writing and
speaking players, the full mock, and Uzbek/Russian translations.

### Images to add

Drop these into `public/` and they replace their placeholders automatically —
no code change needed:

- `instructor.png` (or `.webp`/`.jpg`) — the hero photo, cut out on a
  transparent or white background, portrait, roughly 4:5
- `logo.png` (or `.svg`) — the DN monogram, square

Marketing copy lives in `src/content/site.ts`, deliberately in one module so
adding Uzbek and Russian means swapping it for a per-locale dictionary rather
than editing markup. The showcase results and testimonials on the home page are
placeholder rows from the seed; replace them with real students.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Unit tests (grader, validator, band tables, password hashing) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run convert` | Converts `_source-tests/*.html` into validated JSON in `content/tests/` |
| `npm run db:migrate` | Prisma migration |
| `npm run db:studio` | Browse the database |

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

## Media storage

Listening audio and speaking recordings live in `MEDIA_STORAGE_DIR`, outside the
web root. They are streamed through an authenticated route that checks premium
access, then handed to nginx via `X-Accel-Redirect` in production. Nothing is
served from `public/`.

## Project layout

```
prisma/schema.prisma      database schema
src/lib/tests/            content schema, grader, band tables, validator, access
src/lib/auth/             scrypt passwords, DB-backed sessions, guards, rate limiting
src/lib/attempts/         grading, storage, unrecognized-answer queue
src/components/player/    the CD test player
src/app/api/              auth and attempt routes
src/app/                  login, signup, dashboard, tests, attempt, results
scripts/convert/          HTML to JSON adapters
scripts/seed.ts           admin user, tests, sample homepage content
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
