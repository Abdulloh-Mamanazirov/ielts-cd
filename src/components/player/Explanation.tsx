"use client";

import type { ReviewInfo } from "./QuestionGroupView";

/** Written like a teacher speaking: what was needed, and where the proof sits. */
export function Explanation({
  review,
  onShowEvidence,
}: {
  review: ReviewInfo;
  onShowEvidence?: (evidence: { anchor?: string; snippet?: string }) => void;
}) {
  return (
    <div className="mt-3 rounded-[10px] bg-surface-alt p-4">
      <p className="text-[10px] font-bold tracking-[0.18em] text-ink-subtle">WHY</p>
      {review.overWordLimit && (
        <p className="mt-2 text-sm font-semibold text-brand-red-cta">
          Your answer had the right words but broke the word limit in the instructions.
        </p>
      )}
      {review.explanation ? (
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{review.explanation}</p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          The expected answer was <strong className="text-ink">{review.expected}</strong>.
        </p>
      )}

      {review.evidence?.snippet && onShowEvidence && (
        <button
          type="button"
          onClick={() => onShowEvidence(review.evidence!)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand-blue shadow-[inset_0_0_0_1.5px_rgba(1,84,248,.3)] transition hover:bg-brand-blue hover:text-white"
        >
          Show me where
          <span aria-hidden>→</span>
        </button>
      )}
    </div>
  );
}
