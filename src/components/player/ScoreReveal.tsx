"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";

/**
 * The band, the moment it exists.
 *
 * Marking used to appear only as two small figures in the review header, which
 * is where a student's eye goes last — they had just finished an hour of work
 * and had to hunt for the number. It gets the middle of the screen once, and
 * then gets out of the way: dismissing it drops straight into the marked paper,
 * which is where the learning actually is.
 */
export function ScoreReveal({
  open,
  skillLabel,
  band,
  rawScore,
  totalQuestions,
  isEstimate,
  resultsHref,
  onClose,
}: {
  open: boolean;
  skillLabel: string;
  band: number;
  rawScore: number;
  totalQuestions: number;
  /** A partial test is scaled to 40 questions, so its band is indicative only. */
  isEstimate: boolean;
  resultsHref: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const share = totalQuestions > 0 ? rawScore / totalQuestions : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/70 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm animate-[var(--animate-rise)] overflow-hidden rounded-2xl bg-white text-center shadow-2xl"
      >
        <div className="bg-ink px-7 pb-7 pt-6 text-white">
          <p className="text-[10px] font-bold tracking-[0.22em] text-white/50">
            {isEstimate ? "INDICATIVE BAND" : "YOUR BAND"}
          </p>

          <p id={titleId} className="mt-2 font-display text-[64px] leading-none tracking-[-0.03em]">
            {band.toFixed(1)}
          </p>

          <p className="mt-3 text-[13px] font-semibold text-white/70">
            {skillLabel} · {rawScore} of {totalQuestions} correct
          </p>

          {/* The same figure again as a length, so it reads without arithmetic. */}
          <span aria-hidden className="mt-3 block h-[3px] w-full rounded-full bg-white/15">
            <span
              className="block h-[3px] rounded-full bg-brand-red"
              style={{ width: `${Math.round(share * 100)}%` }}
            />
          </span>
        </div>

        <div className="px-7 pb-7 pt-6">
          {isEstimate && (
            <p className="mb-5 text-[12.5px] leading-relaxed text-ink-muted">
              This test is shorter than the exam, so the score was scaled to forty questions.
              Treat the band as a direction of travel, not a result.
            </p>
          )}

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="w-full rounded-[10px] bg-brand-red-cta px-6 py-3.5 text-sm font-bold text-white shadow-[0_14px_26px_-12px_rgba(225,0,70,.7)] transition hover:bg-brand-red-dark"
          >
            See where I went wrong
          </button>

          <Link
            href={resultsHref}
            className="mt-3 block w-full rounded-[10px] px-6 py-2.5 text-[13px] font-bold text-ink-subtle underline-offset-4 transition hover:text-ink hover:underline"
          >
            Back to my results
          </Link>
        </div>
      </div>
    </div>
  );
}
