"use client";

import { RichHtml } from "./SlotHtml";
import { cn } from "@/lib/utils";

export type OptionMark = "correct" | "chosen-wrong" | "missed" | null;

/**
 * One choice, set the way the computer-delivered test sets it: a control, its
 * letter, and the text on one line. No card, no outline, no fill.
 *
 * That plainness is the point. On the day the student meets a bare list, and a
 * practice screen that looks unlike the exam is one more thing to absorb under
 * time — so the only thing that changes when an option is chosen is the control
 * itself and a quiet tint on the row.
 *
 * In review, colour never carries the meaning alone: every marked option also
 * shows a tick, a cross, or the words "Your answer", so it survives colour
 * blindness and printing.
 */
export function AnswerOption({
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
  // Some sources carry the control letter as the option's entire text, so the
  // badge and the text are the same character and the row reads "C   C". Show
  // it once: the badge is dropped and the text stands on its own.
  const isBareLetter =
    textHtml.replace(/<[^>]*>/g, "").trim().toUpperCase() === letter.trim().toUpperCase();

  return (
    <label
      className={cn(
        // `relative` is load-bearing. The input below is `sr-only`, which is
        // absolutely positioned; without a positioned ancestor its containing
        // block is the document, so every hidden radio lands further down the
        // page and inflates the document's scroll height. Clicking a label then
        // focuses that input and the browser scrolls the whole window to it.
        "relative flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-[7px] transition",
        // The input is visually hidden, so the row has to show its own focus.
        "has-[:focus-visible]:shadow-[0_0_0_2px_#0154f8]",
        !mark && !disabled && "hover:bg-ink/[0.045]",
        !mark && checked && "bg-brand-blue-soft",
        mark === "correct" && "bg-ok-soft",
        mark === "missed" && "bg-ok-soft/60",
        mark === "chosen-wrong" && "bg-bad-soft",
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

      <Control multi={multi} checked={checked} mark={mark} />

      {showLetter && !isBareLetter && (
        <span aria-hidden className="w-[0.9em] flex-none font-bold text-ink">
          {letter}
        </span>
      )}

      <RichHtml html={textHtml} className={cn("flex-1 text-ink", checked && "font-semibold")} />

      {mark && <MarkTag mark={mark} />}
    </label>
  );
}

/** The radio or checkbox itself, drawn rather than native so it can carry a mark. */
function Control({
  multi,
  checked,
  mark,
}: {
  multi: boolean;
  checked: boolean;
  mark: OptionMark;
}) {
  const right = mark === "correct" || mark === "missed";
  const wrong = mark === "chosen-wrong";

  return (
    <span
      aria-hidden
      className={cn(
        "mt-[3px] flex h-[15px] w-[15px] flex-none items-center justify-center transition",
        multi ? "rounded-[3px]" : "rounded-full",
        right && "shadow-[inset_0_0_0_1.5px_#0b7a52]",
        wrong && "shadow-[inset_0_0_0_1.5px_#e10046]",
        !mark && checked && "shadow-[inset_0_0_0_1.5px_#0154f8]",
        !mark && !checked && "shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.35)]",
      )}
    >
      {checked && (
        <span
          className={cn(
            "h-[7px] w-[7px]",
            multi ? "rounded-[1px]" : "rounded-full",
            right ? "bg-ok" : wrong ? "bg-brand-red-cta" : "bg-brand-blue",
          )}
        />
      )}
    </span>
  );
}

function MarkTag({ mark }: { mark: Exclude<OptionMark, null> }) {
  if (mark === "correct") {
    return (
      <span className="ml-auto inline-flex flex-none items-center gap-1.5 pl-3 text-xs font-bold text-ok">
        <Tick /> Your answer
      </span>
    );
  }
  if (mark === "chosen-wrong") {
    return (
      <span className="ml-auto inline-flex flex-none items-center gap-1.5 pl-3 text-xs font-bold text-brand-red-cta">
        <Cross /> Your answer
      </span>
    );
  }
  return (
    <span className="ml-auto inline-flex flex-none items-center gap-1.5 pl-3 text-xs font-bold text-ok">
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
