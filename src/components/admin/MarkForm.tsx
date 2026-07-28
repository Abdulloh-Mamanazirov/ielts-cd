"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { markAttempt } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

/** 0 to 9 in halves, the only values IELTS reports. */
const BANDS = Array.from({ length: 19 }, (_, index) => index / 2);

export function MarkForm({
  attemptId,
  skill,
  currentBand,
  currentFeedback,
  reviewedAt,
}: {
  attemptId: string;
  skill: "WRITING" | "SPEAKING";
  currentBand: number | null;
  currentFeedback: string | null;
  reviewedAt: string | null;
}) {
  const router = useRouter();
  const [band, setBand] = useState<number | null>(currentBand);
  const [feedback, setFeedback] = useState(currentFeedback ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    if (band === null) {
      setError("Choose a band first.");
      return;
    }
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await markAttempt({ attemptId, band, feedback });
      if (result.ok) {
        setMessage(result.message);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <aside className="h-fit bg-white p-5 lg:sticky lg:top-6">
      <p className="text-[10px] font-bold tracking-[0.2em] text-ink-subtle">
        {skill === "WRITING" ? "WRITING BAND" : "SPEAKING BAND"}
      </p>

      {reviewedAt && (
        <p className="mt-1.5 text-[11.5px] text-ink-subtle">Last marked {reviewedAt}</p>
      )}

      <div className="mt-4 grid grid-cols-5 gap-1">
        {BANDS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setBand(value)}
            aria-pressed={band === value}
            className={cn(
              "rounded py-2 text-[12.5px] font-bold tabular-nums transition",
              band === value
                ? "bg-ink text-white"
                : "bg-surface-alt text-ink-muted hover:bg-ink/10",
            )}
          >
            {value.toFixed(1)}
          </button>
        ))}
      </div>

      <label className="mt-5 block">
        <span className="text-[10px] font-bold tracking-[0.2em] text-ink-subtle">
          FEEDBACK
        </span>
        <textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          rows={8}
          placeholder="What would move this up half a band?"
          className="mt-2 w-full resize-y rounded-[9px] bg-surface-alt px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:shadow-[inset_0_0_0_2px_#0154f8]"
        />
      </label>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="mt-4 w-full rounded-[10px] bg-brand-red-cta px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
      >
        {pending ? "Saving…" : currentBand === null ? "Record band" : "Update band"}
      </button>

      {message && <p className="mt-3 text-[12.5px] font-semibold text-ok">{message}</p>}
      {error && <p className="mt-3 text-[12.5px] font-semibold text-brand-red-cta">{error}</p>}

      <p className="mt-4 text-[11.5px] leading-relaxed text-ink-subtle">
        The student sees this band on their dashboard straight away, and it counts towards the
        overall band of any full mock this belongs to.
      </p>
    </aside>
  );
}
