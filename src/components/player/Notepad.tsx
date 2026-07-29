"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A scratchpad for tests with no passage to highlight.
 *
 * Listening is the case that needs it: answers go past faster than they can be
 * written into the boxes, and the exam itself gives candidates paper. It floats
 * rather than taking a column, because the questions are what the student
 * should be looking at.
 */
export function Notepad({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const lines = value.trim() ? value.trim().split("\n").length : 0;

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {open && (
        <div className="pointer-events-auto w-[290px] rounded-xl bg-white p-3 shadow-[0_18px_40px_-12px_rgba(11,17,32,.45)] ring-1 ring-ink/10">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold tracking-[0.2em] text-ink-subtle">NOTES</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close notes"
              className="rounded px-1.5 text-[13px] font-bold text-ink-subtle transition hover:text-ink"
            >
              ✕
            </button>
          </div>

          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            rows={9}
            placeholder="Jot down what you hear. Saved with your attempt."
            className="mt-2 w-full resize-none rounded-[9px] bg-surface-alt px-2.5 py-2 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:shadow-[inset_0_0_0_2px_#0154f8] disabled:opacity-60"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12.5px] font-bold shadow-[0_10px_24px_-10px_rgba(11,17,32,.6)] transition",
          open ? "bg-ink text-white" : "bg-white text-ink-muted hover:bg-ink hover:text-white",
        )}
      >
        <PadIcon />
        Notes
        {lines > 0 && (
          <span className="rounded-full bg-brand-red px-1.5 text-[10px] font-bold text-white tabular-nums">
            {lines}
          </span>
        )}
      </button>
    </div>
  );
}

function PadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h16v12H8l-4 4z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  );
}
