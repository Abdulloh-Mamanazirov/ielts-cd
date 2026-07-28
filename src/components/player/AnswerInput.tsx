"use client";

import { cn } from "@/lib/utils";

/**
 * A gap in the question text. In review it keeps the student's own answer
 * visible and prints the expected one beside it, so the comparison needs no
 * colour to be understood.
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
  return (
    <span className="inline-flex items-baseline gap-1.5 align-baseline">
      <span
        aria-hidden
        className={cn(
          "select-none rounded px-1.5 py-0.5 text-[11px] font-bold",
          verdict === "correct" && "bg-ok text-white",
          verdict === "incorrect" && "bg-brand-red-cta text-white",
          !verdict && "bg-surface-alt text-ink-subtle",
        )}
      >
        {questionNumber}
      </span>

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
        placeholder={disabled && !value ? "—" : undefined}
        className={cn(
          "rounded-md bg-white px-2.5 py-1 text-[0.9em] text-ink outline-none transition",
          "shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.2)]",
          "focus:shadow-[inset_0_0_0_2px_#0154f8]",
          letterOnly ? "w-11 text-center uppercase" : "w-36",
          isActive && !verdict && "shadow-[inset_0_0_0_2px_#0154f8]",
          verdict === "correct" && "bg-ok-soft shadow-[inset_0_0_0_1.5px_#0b7a52]",
          verdict === "incorrect" &&
            "bg-bad-soft text-brand-red-cta line-through shadow-[inset_0_0_0_1.5px_#e10046]",
          disabled && "cursor-default",
        )}
      />

      {verdict === "incorrect" && expected && (
        <span className="inline-flex items-baseline gap-1 text-[0.85em] font-bold text-ok">
          <span aria-hidden>→</span>
          <span>{expected}</span>
        </span>
      )}
    </span>
  );
}
