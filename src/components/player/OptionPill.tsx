"use client";

import { RichHtml } from "./SlotHtml";
import { cn } from "@/lib/utils";

export type OptionMark = "correct" | "chosen-wrong" | "missed" | null;

/**
 * A choice, as a pill rather than a bare radio.
 *
 * In review, colour never carries the meaning alone: every marked option also
 * shows a tick, a cross, or the words "Your answer", so it survives colour
 * blindness and printing.
 */
export function OptionPill({
  letter,
  textHtml,
  showLetter,
  checked,
  multi,
  name,
  disabled,
  mark,
  onSelect,
}: {
  letter: string;
  textHtml: string;
  showLetter: boolean;
  checked: boolean;
  multi: boolean;
  name: string;
  disabled: boolean;
  mark: OptionMark;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-[9px] px-3.5 py-2.5 text-sm transition",
        !mark && "bg-white shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.16)] hover:shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.4)]",
        !mark && checked && "shadow-[inset_0_0_0_2px_#0154f8]",
        mark === "correct" && "bg-ok-soft font-semibold shadow-[inset_0_0_0_2px_#0b7a52]",
        mark === "missed" && "bg-ok-soft shadow-[inset_0_0_0_1.5px_rgba(11,122,82,.5)]",
        mark === "chosen-wrong" && "bg-bad-soft font-semibold shadow-[inset_0_0_0_2px_#e10046]",
        disabled && "cursor-default",
      )}
    >
      <input
        type={multi ? "checkbox" : "radio"}
        name={name}
        value={letter}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only"
      />

      <span
        aria-hidden
        className={cn(
          "flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-[11.5px] font-bold",
          mark === "correct" || mark === "missed"
            ? "bg-ok text-white"
            : mark === "chosen-wrong"
              ? "bg-brand-red-cta text-white"
              : checked
                ? "bg-brand-blue text-white"
                : "text-ink shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.25)]",
        )}
      >
        {showLetter ? letter : checked ? "●" : ""}
      </span>

      <RichHtml html={textHtml} className="flex-1 text-ink" />

      {mark && <MarkTag mark={mark} />}
    </label>
  );
}

function MarkTag({ mark }: { mark: Exclude<OptionMark, null> }) {
  if (mark === "correct") {
    return (
      <span className="ml-auto inline-flex flex-none items-center gap-1.5 text-xs font-bold text-ok">
        <Tick /> Your answer
      </span>
    );
  }
  if (mark === "chosen-wrong") {
    return (
      <span className="ml-auto inline-flex flex-none items-center gap-1.5 text-xs font-bold text-brand-red-cta">
        <Cross /> Your answer
      </span>
    );
  }
  return (
    <span className="ml-auto inline-flex flex-none items-center gap-1.5 text-xs font-bold text-ok">
      <Tick /> Correct
    </span>
  );
}

function Tick() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
