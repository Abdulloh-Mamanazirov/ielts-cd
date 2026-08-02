# Source tests (not versioned)

The instructor's original `@bekhruzposts` HTML mocks (and the odd PDF) land here
to be converted. **Nothing in this folder is committed except this note** — the
files are large, arrive in ad-hoc subfolders under ever-changing names, and some
listening exports embed 30–40 MB of base64 audio. The converted JSON in
`content/tests/` is the versioned source of truth.

## Converting

Drop the source files anywhere under this folder — loose or in per-Volume
subfolders (`vol5/`, `vol6/`, …); the names need not be tidy. Then:

```bash
npm run convert
```

Discovery reads each file's skill, test number and Volume from its filename and
its `<title>`, falling back to the enclosing `volN/` folder for the Volume, and
writes `content/tests/<skill>-volume-<n>-test-<m>.json`. A file it cannot place,
or that fails validation, is reported and skipped — the rest still convert.

Then load them and attach listening audio:

```bash
npm run db:seed
npm run audio:upload -- --all --publish
```

Listening audio is either embedded as base64 (extracted here to `<slug>.mp3`) or
hot-linked from an external host (downloaded by the uploader). See the project
README and `docs/DEPLOY.md`.
