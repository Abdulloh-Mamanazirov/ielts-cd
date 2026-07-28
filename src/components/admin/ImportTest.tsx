"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { importTest } from "@/app/admin/actions";

/**
 * Paste-in importer. The same validator the conversion scripts use runs here,
 * so a test that would fail at the command line fails in the browser with the
 * same message rather than silently landing half-formed.
 */
export function ImportTest() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await importTest(json);
      if (result.ok) {
        setMessage(result.message);
        setJson("");
        router.refresh();
      } else {
        setError(result.error);
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
        Import a test from JSON
      </button>
    );
  }

  return (
    <section className="bg-white p-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-ink-subtle">IMPORT</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-bold text-ink-subtle hover:text-ink"
        >
          Close
        </button>
      </div>

      <p className="mt-2 max-w-[70ch] text-[13px] leading-relaxed text-ink-muted">
        Paste the canonical test JSON — the same shape the conversion scripts write into{" "}
        <code className="rounded bg-surface-alt px-1">content/tests/</code>. It is checked before
        anything is saved, and always arrives as a draft.
      </p>

      <textarea
        value={json}
        onChange={(event) => setJson(event.target.value)}
        rows={12}
        spellCheck={false}
        placeholder='{ "slug": "…", "content": { … }, "answerKey": { … } }'
        className="mt-4 w-full resize-y rounded-[9px] bg-surface-alt px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:shadow-[inset_0_0_0_2px_#0154f8]"
      />

      <button
        type="button"
        onClick={submit}
        disabled={pending || json.trim().length === 0}
        className="mt-3 rounded-[10px] bg-brand-red-cta px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-50"
      >
        {pending ? "Checking…" : "Validate and import"}
      </button>

      {message && <p className="mt-3 text-[12.5px] font-semibold text-ok">{message}</p>}
      {error && (
        <p className="mt-3 whitespace-pre-wrap text-[12.5px] font-semibold text-brand-red-cta">
          {error}
        </p>
      )}
    </section>
  );
}
