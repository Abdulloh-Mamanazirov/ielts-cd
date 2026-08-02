"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateTestDetails } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

/**
 * Inline editor for a library test's shelf details — title, premium, duration.
 * Collapsed to a single link until opened, so the row stays a row; content and
 * answers are not editable here, since those come from re-importing JSON.
 */
export function TestDetails({
  testId,
  title,
  isPremium,
  durationSeconds,
}: {
  testId: string;
  title: string;
  isPremium: boolean;
  durationSeconds: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftPremium, setDraftPremium] = useState(isPremium);
  const [draftMinutes, setDraftMinutes] = useState(Math.round(durationSeconds / 60));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    draftTitle.trim() !== title ||
    draftPremium !== isPremium ||
    draftMinutes !== Math.round(durationSeconds / 60);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateTestDetails({
        testId,
        title: draftTitle,
        isPremium: draftPremium,
        durationMinutes: draftMinutes,
      });
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const cancel = () => {
    setDraftTitle(title);
    setDraftPremium(isPremium);
    setDraftMinutes(Math.round(durationSeconds / 60));
    setError(null);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[9px] bg-surface-alt px-3 py-2 text-[12px] font-bold text-ink-muted transition hover:bg-ink hover:text-white"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-xl bg-surface-alt p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold tracking-[0.12em] text-ink-subtle">TITLE</span>
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            className="w-full rounded-lg bg-white px-3 py-2 text-sm text-ink outline-none shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.16)] focus:shadow-[inset_0_0_0_2px_#0154f8]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold tracking-[0.12em] text-ink-subtle">MINUTES</span>
          <input
            type="number"
            min={1}
            max={240}
            value={draftMinutes}
            onChange={(event) => setDraftMinutes(Number(event.target.value))}
            className="w-24 rounded-lg bg-white px-3 py-2 text-sm text-ink outline-none shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.16)] focus:shadow-[inset_0_0_0_2px_#0154f8]"
          />
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2.5 pb-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={draftPremium}
            onChange={(event) => setDraftPremium(event.target.checked)}
            className="h-4 w-4 accent-[#0154f8]"
          />
          Premium
        </label>
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-brand-red-cta">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-white transition hover:bg-ink/85 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className={cn(
            "rounded-lg bg-white px-4 py-2 text-[13px] font-bold text-ink-muted transition hover:bg-ink hover:text-white disabled:opacity-50",
          )}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
