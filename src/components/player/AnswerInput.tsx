"use client";

import { cn } from "@/lib/utils";

/**
 * A gap in the question text.
 *
 * The number lives *inside* the box, as the computer-delivered test draws it:
 * centred while the gap is empty, then stepped aside to the right once there is
 * an answer to read. A separate chip beside the field was a shape the exam does
 * not have, and it broke the line of the sentence it sits in.
 *
 * In review it keeps the student's own answer visible and prints the expected
 * one beside it, so the comparison needs no colour to be understood.
 */
export function AnswerInput({
  questionNumber,
  value,
  onChange,
  onFocus,
  isActive,
  verdict,
  expected,
  letterOnly = false,
  disabled = false,
}: {
  questionNumber: number;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  isActive?: boolean;
  verdict?: "correct" | "incorrect";
  expected?: string;
  letterOnly?: boolean;
  disabled?: boolean;
}) {
  const filled = value.trim().length > 0;
  // A one-letter box has no room to keep the number beside the answer, so there
  // it gives way; a word box reserves a strip on the right for it.
  const showNumber = !filled || !letterOnly;

  return (
    <span className="inline-flex items-baseline gap-1.5 align-baseline">
      <span className="relative inline-block">
        <input
          id={`q${questionNumber}`}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize={letterOnly ? "characters" : "off"}
          spellCheck={false}
          maxLength={letterOnly ? 1 : 60}
          aria-label={`Answer for question ${questionNumber}`}
          className={cn(
            "rounded-[3px] bg-white px-2 py-[3px] text-[0.92em] text-ink outline-none transition",
            "shadow-[inset_0_0_0_1px_rgba(11,17,32,.4)]",
            "focus:shadow-[inset_0_0_0_2px_#0154f8]",
            letterOnly ? "w-12 text-center uppercase" : "w-40 pr-7",
            isActive && !verdict && "shadow-[inset_0_0_0_2px_#0154f8]",
            verdict === "correct" && "bg-ok-soft shadow-[inset_0_0_0_1.5px_#0b7a52]",
            // Wrong answers are outlined, never filled. A block of red behind a
            // student's own handwriting reads as a telling-off; the ring, the
            // strike-through and the correct answer beside it already say it.
            verdict === "incorrect" &&
              "text-brand-red-cta line-through shadow-[inset_0_0_0_1.5px_#e10046]",
            disabled && "cursor-default",
          )}
        />

        {showNumber && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 flex items-center text-[0.82em] font-bold tabular-nums",
              filled
                ? "right-2 text-ink-faint"
                : "inset-x-0 justify-center text-ink-subtle",
            )}
          >
            {questionNumber}
          </span>
        )}
      </span>

      {verdict === "incorrect" && expected && (
        <span className="inline-flex items-baseline gap-1 text-[0.85em] font-bold text-ok">
          <span aria-hidden>→</span>
          <span>{expected}</span>
        </span>
      )}
    </span>
  );
}
