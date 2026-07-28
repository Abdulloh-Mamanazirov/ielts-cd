"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The one place red fills rather than outlines.
 *
 * The shell is shared because every skill needs the same modal behaviour, but
 * the summary above the buttons is not: a reading test can promise marks
 * straight away, and a writing test cannot.
 */
export function ConfirmDialog({
  open,
  eyebrow,
  title,
  confirmLabel,
  confirmingLabel,
  cancelLabel = "Keep working",
  submitting,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  eyebrow: string;
  title: string;
  confirmLabel: string;
  confirmingLabel: string;
  cancelLabel?: string;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 p-5 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl"
      >
        <p className="text-[10px] font-bold tracking-[0.22em] text-brand-red-cta">{eyebrow}</p>
        <h2
          id={titleId}
          className="mt-3 font-display text-2xl leading-[1.1] tracking-[-0.02em] text-ink"
        >
          {title}
        </h2>

        {children}

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 rounded-[10px] bg-brand-red-cta px-6 py-3.5 text-sm font-bold text-white shadow-[0_14px_26px_-12px_rgba(225,0,70,.7)] transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            {submitting ? confirmingLabel : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-[10px] bg-surface-alt px-6 py-3.5 text-sm font-bold text-ink transition hover:bg-ink hover:text-white disabled:opacity-60"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Names the exact number of gaps left, because "are you sure?" is not information. */
export function SubmitDialog({
  open,
  answered,
  total,
  flagged,
  submitting,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  answered: number;
  total: number;
  flagged: number;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const unanswered = total - answered;

  return (
    <ConfirmDialog
      open={open}
      eyebrow="SUBMIT TEST"
      title={
        unanswered === 0
          ? "Every question is answered."
          : `${unanswered} question${unanswered === 1 ? "" : "s"} left blank.`
      }
      confirmLabel="Submit and mark"
      confirmingLabel="Submitting…"
      submitting={submitting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <dl className="mt-5 flex gap-px overflow-hidden rounded-lg bg-rule">
        <Cell label="Answered" value={`${answered}/${total}`} />
        <Cell label="Blank" value={String(unanswered)} accent={unanswered > 0} />
        <Cell label="Flagged" value={String(flagged)} accent={flagged > 0} />
      </dl>

      <p className="mt-5 text-sm leading-relaxed text-ink-muted">
        You cannot change your answers after submitting. Your score and full marking appear
        straight away.
      </p>
    </ConfirmDialog>
  );
}

export function Cell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex-1 bg-white px-3 py-2.5 text-center">
      <dt className="text-[9.5px] font-bold tracking-[0.16em] text-ink-subtle">
        {label.toUpperCase()}
      </dt>
      <dd
        className={cn(
          "mt-1 font-display text-lg leading-none",
          accent ? "text-brand-red-cta" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
