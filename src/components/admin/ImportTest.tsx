"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { importTest, type ImportResult } from "@/app/admin/actions";

/**
 * Bringing a test in.
 *
 * The instructor is not a developer, so the screen has to say where the JSON
 * comes from and what will happen to it. The same validator the conversion
 * scripts use runs here, and its warnings are shown on success too — a test can
 * import cleanly and still have a rubric that promises a word limit it does not
 * enforce.
 */
export function ImportTest() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setFilename(file.name);
    setJson(await file.text());
  };

  const submit = () => {
    setResult(null);
    startTransition(async () => {
      const outcome = await importTest(json);
      setResult(outcome);
      if (outcome.ok) {
        setJson("");
        setFilename(null);
        router.refresh();
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[10px] bg-ink px-5 py-3 text-sm font-bold text-white transition hover:bg-ink/85"
      >
        Add a test
      </button>
    );
  }

  return (
    <section className="bg-white p-5 lg:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-ink-subtle">ADD A TEST</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-bold text-ink-subtle transition hover:text-ink"
        >
          Close
        </button>
      </div>

      <h3 className="mt-2 font-display text-lg leading-tight text-ink">
        Where the file comes from
      </h3>

      <ol className="mt-3 max-w-[72ch] space-y-2.5 text-[13px] leading-relaxed text-ink-muted">
        <Step n={1}>
          Get the test as JSON. Either take a ready-made file from the{" "}
          <code className="rounded bg-surface-alt px-1 py-0.5">content/tests/</code> folder, or
          give a PDF or Word paper to an AI assistant and ask it to produce this project&apos;s
          test JSON — the shape is below.
        </Step>
        <Step n={2}>
          Drop the file in, or paste its contents. Nothing is saved until it passes every check.
        </Step>
        <Step n={3}>
          It arrives as a <strong className="font-bold text-ink">draft</strong>. Students cannot
          see it until you press <strong className="font-bold text-ink">PUBLISHED</strong> on its
          row below — and a listening test needs its audio uploaded first.
        </Step>
      </ol>

      <details className="mt-4 max-w-[72ch] rounded-[10px] bg-surface-alt p-3.5">
        <summary className="cursor-pointer text-[12.5px] font-bold text-ink">
          What the JSON has to look like
        </summary>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
          Two documents in one file. <code className="rounded bg-white px-1">content</code> is what
          the student sees; <code className="rounded bg-white px-1">answerKey</code> never leaves
          the server. Question numbers must run 1..N with no gaps, and every one needs an entry in
          the key — the checker grades the key against itself and refuses anything short of full
          marks.
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 font-mono text-[11.5px] leading-relaxed text-ink">
{`{
  "slug": "cambridge-22-reading-test-1",
  "isPremium": true,
  "content": {
    "schemaVersion": 1,
    "skill": "reading",
    "title": "Cambridge 22 Reading Test 1",
    "totalQuestions": 40,
    "durationSeconds": 3600,
    "parts": [ … ]
  },
  "answerKey": {
    "schemaVersion": 1,
    "answers": { "1": { "accepted": ["camouflage"] } },
    "sets": []
  }
}`}
        </pre>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
          Writing uses <code className="rounded bg-white px-1">tasks</code> and speaking uses{" "}
          <code className="rounded bg-white px-1">prompts</code> instead of{" "}
          <code className="rounded bg-white px-1">parts</code>, with{" "}
          <code className="rounded bg-white px-1">totalQuestions: 0</code> and an empty answer key.
          The files already in <code className="rounded bg-white px-1">content/tests/</code> are
          the best examples to copy.
        </p>
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={(event) => loadFile(event.target.files?.[0])}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="rounded-[9px] bg-surface-alt px-4 py-2.5 text-[13px] font-bold text-ink transition hover:bg-ink hover:text-white"
        >
          Choose a .json file
        </button>
        {filename && (
          <span className="text-[12.5px] text-ink-subtle">
            Loaded <strong className="font-bold text-ink">{filename}</strong>
          </span>
        )}
      </div>

      <textarea
        value={json}
        onChange={(event) => {
          setJson(event.target.value);
          setFilename(null);
        }}
        onDrop={async (event) => {
          const file = event.dataTransfer.files?.[0];
          if (file) {
            event.preventDefault();
            await loadFile(file);
          }
        }}
        rows={10}
        spellCheck={false}
        placeholder="…or paste the JSON here, or drag the file onto this box."
        className="mt-3 w-full resize-y rounded-[9px] bg-surface-alt px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink outline-none placeholder:font-sans placeholder:text-ink-faint focus:shadow-[inset_0_0_0_2px_#0154f8]"
      />

      <button
        type="button"
        onClick={submit}
        disabled={pending || json.trim().length === 0}
        className="mt-3 rounded-[10px] bg-brand-red-cta px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-50"
      >
        {pending ? "Checking…" : "Check and import"}
      </button>

      {result && <Outcome result={result} />}
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-[19px] w-[19px] flex-none items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Outcome({ result }: { result: ImportResult }) {
  if (!result.ok) {
    return (
      <div className="mt-4 rounded-[10px] bg-bad-soft p-4">
        <p className="text-[13px] font-bold text-brand-red-cta">{result.error}</p>
        {result.issues.length > 0 && (
          <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-muted">
            {result.issues.slice(0, 12).map((issue, index) => (
              <li key={index}>• {issue}</li>
            ))}
            {result.issues.length > 12 && (
              <li className="italic">…and {result.issues.length - 12} more.</li>
            )}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[10px] bg-ok-soft p-4">
      <p className="text-[13px] font-bold text-ok">{result.message}</p>
      <p className="mt-1 text-[12.5px] text-ink-muted">{result.summary}</p>

      {result.warnings.length > 0 && (
        <>
          <p className="mt-3 text-[11px] font-bold tracking-[0.14em] text-ink-subtle">
            WORTH CHECKING
          </p>
          <ul className="mt-1 space-y-1 text-[12.5px] leading-relaxed text-ink-muted">
            {result.warnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
