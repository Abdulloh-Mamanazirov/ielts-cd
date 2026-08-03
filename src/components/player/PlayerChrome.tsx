"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import type { SaveStatus } from "./useAutosave";

const DANGER_SECONDS = 5 * 60;

/**
 * Live header. Chrome recedes: no colour anywhere except the submit outline,
 * and no motion until the last five minutes.
 */
export function PlayerHeader({
  title,
  subtitle,
  exitHref,
  remaining,
  totalSeconds,
  saveStatus,
  textSize,
  onTextSize,
  canDecrease,
  canIncrease,
  onSubmit,
  submitting,
}: {
  title: string;
  subtitle: string;
  /** Back to the list the student came from, not the undifferentiated one. */
  exitHref: string;
  remaining: number | null;
  totalSeconds: number;
  saveStatus: SaveStatus;
  textSize: number;
  onTextSize: (direction: 1 | -1) => void;
  canDecrease: boolean;
  canIncrease: boolean;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <header className="flex h-[66px] flex-none items-center justify-between gap-6 border-b border-ink/[0.12] bg-white px-4 lg:px-[22px]">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href={exitHref}
          className="inline-flex items-center gap-2 rounded-[9px] bg-surface-alt px-3.5 py-2.5 text-[13px] font-bold text-ink-muted transition hover:bg-ink hover:text-white"
        >
          <ArrowLeft />
          <span className="hidden sm:inline">Exit</span>
        </Link>

        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-ink">{title}</p>
          <p className="truncate text-[11.5px] text-ink-subtle">{subtitle}</p>
        </div>

        <TelegramLink />
      </div>

      <div className="flex flex-none items-center gap-3 lg:gap-4">
        {remaining !== null && (
          <Timer remaining={remaining} totalSeconds={totalSeconds} />
        )}

        <TextSizeControl
          size={textSize}
          onStep={onTextSize}
          canDecrease={canDecrease}
          canIncrease={canIncrease}
        />

        <SaveIndicator status={saveStatus} />

        {/* The only red-outlined control on the screen, and it never fills red
            until the confirmation dialog. */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-[9px] bg-white px-4 py-3 text-[14.5px] font-bold text-brand-red-cta shadow-[inset_0_0_0_1.5px_rgba(225,0,70,.45)] transition hover:shadow-[inset_0_0_0_2px_rgba(225,0,70,.8)] disabled:opacity-50 lg:px-[22px]"
        >
          {submitting ? "Submitting…" : "Submit test"}
        </button>
      </div>
    </header>
  );
}

function Timer({ remaining, totalSeconds }: { remaining: number; totalSeconds: number }) {
  const danger = remaining <= DANGER_SECONDS;
  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, remaining / totalSeconds)) : 0;

  return (
    <div
      role="timer"
      aria-live={danger ? "polite" : "off"}
      aria-label={`${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining`}
      className="flex flex-col items-center gap-1.5 rounded-[9px] bg-surface-alt px-3.5 py-2"
    >
      <span
        className={cn(
          "font-display text-[17px] leading-none tabular-nums",
          danger ? "animate-[var(--animate-pulse-slow)] text-brand-red-cta" : "text-ink",
        )}
      >
        {formatClock(remaining)}
      </span>
      {/* Depleting rule: the same information again, without needing to read. */}
      <span
        aria-hidden
        className={cn(
          "block h-[3px] w-[70px] rounded-sm",
          danger ? "bg-brand-red-cta/20" : "bg-ink/15",
        )}
      >
        <span
          className={cn(
            "block h-[3px] rounded-sm transition-[width] duration-1000 ease-linear",
            danger ? "bg-brand-red-cta" : "bg-ink",
          )}
          style={{ width: `${fraction * 100}%` }}
        />
      </span>
    </div>
  );
}

function TextSizeControl({
  size,
  onStep,
  canDecrease,
  canIncrease,
}: {
  size: number;
  onStep: (direction: 1 | -1) => void;
  canDecrease: boolean;
  canIncrease: boolean;
}) {
  return (
    <div className="hidden items-center gap-0.5 rounded-[9px] bg-surface-alt px-1.5 py-1 sm:flex">
      <button
        type="button"
        onClick={() => onStep(-1)}
        disabled={!canDecrease}
        aria-label="Smaller text"
        className="h-7 w-7 rounded text-sm font-bold text-ink transition hover:bg-white disabled:opacity-30"
      >
        A−
      </button>
      <span className="w-8 text-center text-[11px] font-bold tabular-nums text-ink-subtle">
        {size}
      </span>
      <button
        type="button"
        onClick={() => onStep(1)}
        disabled={!canIncrease}
        aria-label="Larger text"
        className="h-7 w-7 rounded text-base font-bold text-ink transition hover:bg-white disabled:opacity-30"
      >
        A+
      </button>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  const failed = status === "error" || status === "expired";
  const label = {
    saving: "Saving…",
    saved: "All answers saved",
    error: "Not saved — retrying",
    expired: "Time is up",
    idle: "",
  }[status];

  return (
    <span
      className={cn(
        "hidden items-center gap-2 text-[12.5px] font-semibold xl:inline-flex",
        failed ? "text-brand-red-cta" : "text-ink-muted",
      )}
    >
      {status === "saved" && (
        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ok text-white">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      )}
      {label}
    </span>
  );
}

/** Review header. Same layout, inverted value — you can never mistake it for a live attempt. */
export function ReviewHeader({
  title,
  submittedAt,
  timeUsed,
  rawScore,
  totalQuestions,
  band,
  isEstimate,
}: {
  title: string;
  submittedAt: string;
  timeUsed: string | null;
  rawScore: number;
  totalQuestions: number;
  band: number;
  isEstimate: boolean;
}) {
  return (
    <header className="flex min-h-[66px] flex-none flex-wrap items-center justify-between gap-4 bg-ink px-4 py-3 text-white lg:px-[22px] lg:py-0">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-[9px] bg-white/10 px-3.5 py-2.5 text-[13px] font-bold transition hover:bg-white hover:text-ink"
        >
          <ArrowLeft />
          <span className="hidden sm:inline">My results</span>
        </Link>

        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold">{title} — review</p>
          <p className="mt-0.5 truncate text-[11.5px] text-white/55">
            Submitted {submittedAt}
            {timeUsed && ` · ${timeUsed} used`}
          </p>
        </div>
      </div>

      <div className="flex flex-none items-center gap-6 lg:gap-[26px]">
        <div className="text-right">
          <p className="text-[9.5px] font-bold tracking-[0.18em] text-white/50">CORRECT</p>
          <p className="mt-1 font-display text-[22px] leading-none">
            {rawScore}
            <span className="text-sm text-white/50">/{totalQuestions}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9.5px] font-bold tracking-[0.18em] text-white/50">
            {isEstimate ? "INDICATIVE" : "BAND"}
          </p>
          <p className="mt-1 font-display text-[22px] leading-none text-brand-red">
            {band.toFixed(1)}
          </p>
        </div>
      </div>
    </header>
  );
}

/**
 * The instructor's channel. Opens in its own tab — the attempt's timer is
 * server-authoritative, so leaving the page never buys or costs a student time,
 * and they land back on the exam exactly where they left it. Quiet by default,
 * Telegram-blue on hover; icon only until there is room for the name.
 */
function TelegramLink() {
  return (
    <a
      href="https://t.me/DN_IELTS"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open our Telegram channel, DN IELTS, in a new tab"
      className="inline-flex flex-none items-center gap-2 rounded-[9px] bg-[#e9f5fc] px-3 py-2.5 text-[13px] font-bold text-[#1b7fb5] transition hover:bg-[#229ed9] hover:text-white"
    >
      <TelegramGlyph />
      <span className="hidden font-bold md:inline">DN IELTS Telegram</span>
    </a>
  );
}

function TelegramGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.94 4.72 18.62 20.4c-.25 1.1-.9 1.38-1.83.86l-5.05-3.72-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.16 9.4-8.49c.41-.36-.09-.56-.63-.2L5.19 13.5.18 11.93c-1.09-.34-1.11-1.09.23-1.61l19.6-7.56c.9-.34 1.7.2 1.4 1.66l.53.3z" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
