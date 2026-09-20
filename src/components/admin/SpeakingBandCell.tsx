"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setEventSpeakingBand } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

/** 0 to 9 in half bands, highest first — the common ones are near the top. */
const BANDS = Array.from({ length: 19 }, (_, index) => 9 - index * 0.5);

/**
 * The speaking band for one event participant, set straight from the roster
 * after the face-to-face interview. A select rather than a text box: it can
 * only produce a real band, and it saves the moment it changes.
 */
export function SpeakingBandCell({
  participantId,
  band,
  disabled = false,
}: {
  participantId: string;
  band: number | null;
  /** Until the student has finished, there is no sitting to add a band to. */
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<number | null>(band);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (next: number | null) => {
    const previous = value;
    setValue(next);
    setError(null);
    start(async () => {
      const result = await setEventSpeakingBand({ participantId, band: next });
      if (!result.ok) {
        setValue(previous);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end">
      <select
        value={value === null ? "" : String(value)}
        disabled={disabled || pending}
        onChange={(event) => save(event.target.value === "" ? null : Number(event.target.value))}
        aria-label="Speaking band"
        title={disabled ? "Available once the student has finished the paper" : "Speaking band"}
        className={cn(
          "w-[4.5rem] rounded-[7px] px-2 py-1 text-right text-[13px] font-bold tabular-nums outline-none transition",
          value === null
            ? "bg-surface-alt text-ink-subtle"
            : "bg-brand-blue-soft text-ink shadow-[inset_0_0_0_1.5px_rgba(1,84,248,.35)]",
          "focus:shadow-[inset_0_0_0_2px_#0154f8] disabled:opacity-50",
        )}
      >
        <option value="">—</option>
        {BANDS.map((option) => (
          <option key={option} value={String(option)}>
            {option.toFixed(1)}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 text-[10px] font-bold text-bad">{error}</span>}
    </div>
  );
}
