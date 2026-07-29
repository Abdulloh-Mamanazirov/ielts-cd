"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { importTest, type ImportResult } from "@/app/admin/actions";
import { IMPORT_PROMPTS } from "@/lib/admin/import-prompts";
import type { SkillSlug } from "@/lib/tests/schema";
import { cn } from "@/lib/utils";

/**
 * Bringing a test in.
 *
 * The hard part is not the upload, it is getting usable JSON out of a PDF. So
 * the screen leads with a ready-made prompt per skill: the instructor copies
 * one, hands it to any AI model along with the paper, and pastes the reply
 * back. The prompts spell out every rule the validator enforces, because the
 * alternative is a round trip through error messages the model cannot see.
 */
export function ImportTest() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [skill, setSkill] = useState<SkillSlug>("reading");
  const [copied, setCopied] = useState(false);

  const [json, setJson] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [isPremium, setIsPremium] = useState(true);

  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const active = IMPORT_PROMPTS.find((entry) => entry.skill === skill)!;

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setFilename(file.name);
    setJson(await file.text());
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(active.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submit = () => {
    setResult(null);
    startTransition(async () => {
      const outcome = await importTest(json, { title, slug, isPremium });
      setResult(outcome);
      if (outcome.ok) {
        setJson("");
        setFilename(null);
        setTitle("");
        setSlug("");
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

      {/* Step 1 — the prompt */}
      <h3 className="mt-3 font-display text-lg leading-tight text-ink">
        1. Turn your paper into JSON
      </h3>
      <p className="mt-1.5 max-w-[72ch] text-[13px] leading-relaxed text-ink-muted">
        Pick the skill, copy the prompt, and give it to any AI model together with the PDF, the
        photos, or the old HTML test file. Paste its reply into the box below. The prompt already
        contains every rule this importer checks, so a cheap model is enough.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {IMPORT_PROMPTS.map((entry) => (
          <button
            key={entry.skill}
            type="button"
            onClick={() => setSkill(entry.skill)}
            className={cn(
              "rounded-[9px] px-3.5 py-2 text-[12.5px] font-bold transition",
              entry.skill === skill
                ? "bg-ink text-white"
                : "bg-surface-alt text-ink-muted hover:bg-ink/10",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-[10px] bg-surface-alt p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-ink-muted">{active.hint}</p>
          <button
            type="button"
            onClick={copyPrompt}
            className={cn(
              "rounded-[9px] px-4 py-2 text-[12.5px] font-bold transition",
              copied ? "bg-ok text-white" : "bg-ink text-white hover:bg-ink/85",
            )}
          >
            {copied ? "Copied ✓" : `Copy the ${active.label.toLowerCase()} prompt`}
          </button>
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] font-bold text-ink-subtle">
            Read it first
          </summary>
          <pre className="mt-2 max-h-[280px] overflow-auto rounded-lg bg-white p-3 font-mono text-[11px] leading-relaxed text-ink-muted">
            {active.prompt}
          </pre>
        </details>
      </div>

      {/* Step 2 — the JSON */}
      <h3 className="mt-6 font-display text-lg leading-tight text-ink">2. Paste the reply</h3>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json,.txt"
          onChange={(event) => loadFile(event.target.files?.[0])}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="rounded-[9px] bg-surface-alt px-4 py-2.5 text-[13px] font-bold text-ink transition hover:bg-ink hover:text-white"
        >
          Choose a file
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
        rows={9}
        spellCheck={false}
        placeholder="…or paste the JSON here, or drag the file onto this box."
        className="mt-3 w-full resize-y rounded-[9px] bg-surface-alt px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink outline-none placeholder:font-sans placeholder:text-ink-faint focus:shadow-[inset_0_0_0_2px_#0154f8]"
      />

      {/* Step 3 — how it appears */}
      <h3 className="mt-6 font-display text-lg leading-tight text-ink">3. How it appears</h3>
      <p className="mt-1.5 text-[13px] text-ink-muted">
        Leave the name blank to keep whatever the file says.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Name students see">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Cambridge 22 Reading Test 1"
            className="w-full rounded-[9px] bg-surface-alt px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:shadow-[inset_0_0_0_2px_#0154f8]"
          />
        </Field>

        <Field label="Web address (optional)">
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="made from the name if left blank"
            className="w-full rounded-[9px] bg-surface-alt px-3 py-2.5 font-mono text-[12.5px] text-ink outline-none placeholder:font-sans placeholder:text-ink-faint focus:shadow-[inset_0_0_0_2px_#0154f8]"
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Toggle active={isPremium} onClick={() => setIsPremium(true)}>
          Premium — paying students only
        </Toggle>
        <Toggle active={!isPremium} onClick={() => setIsPremium(false)}>
          Free — anyone signed in
        </Toggle>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={pending || json.trim().length === 0}
        className="mt-5 rounded-[10px] bg-brand-red-cta px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-50"
      >
        {pending ? "Checking…" : "Check and import"}
      </button>

      <p className="mt-2 text-[12px] text-ink-subtle">
        It arrives as a draft. Nothing is visible to students until you publish it.
      </p>

      {result && <Outcome result={result} />}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold tracking-[0.18em] text-ink-subtle">
        {label.toUpperCase()}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-[9px] px-3.5 py-2 text-[12.5px] font-bold transition",
        active ? "bg-ink text-white" : "bg-surface-alt text-ink-muted hover:bg-ink/10",
      )}
    >
      {children}
    </button>
  );
}

function Outcome({ result }: { result: ImportResult }) {
  if (!result.ok) {
    return (
      <div className="mt-4 rounded-[10px] bg-bad-soft p-4">
        <p className="text-[13px] font-bold text-brand-red-cta">{result.error}</p>
        {result.issues.length > 0 && (
          <>
            <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-muted">
              {result.issues.slice(0, 12).map((issue, index) => (
                <li key={index}>• {issue}</li>
              ))}
              {result.issues.length > 12 && (
                <li className="italic">…and {result.issues.length - 12} more.</li>
              )}
            </ul>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
              Paste this list back to the AI along with the prompt and ask it to fix them. If it
              keeps failing, check it did not wrap the reply in{" "}
              <code className="rounded bg-white px-1">```json</code> fences.
            </p>
          </>
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
