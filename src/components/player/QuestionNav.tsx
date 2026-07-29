"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type NavPart = { number: number; questions: number[] };

/**
 * The bar along the bottom, built the way the computer-delivered test builds
 * it: the part you are in opens out into its question numbers, and the other
 * parts stay shut, showing only how much of each is done.
 *
 * Showing all forty numbers at once — the old behaviour — cost a row of screen
 * and told a student in part 1 about part 4, which is noise while the clock is
 * running. Collapsed parts are still one click away.
 *
 * Four states, and none of them relies on colour alone: answered is underlined,
 * current is boxed, flagged carries a dot, and in review right and wrong are
 * also the only ones that stay coloured.
 */
export function QuestionNav({
  parts,
  activePart,
  activeQuestion,
  answers,
  flags,
  verdictFor,
  reviewMode,
  onSelectQuestion,
}: {
  parts: NavPart[];
  activePart: number;
  activeQuestion: number;
  answers: Record<string, string>;
  flags: number[];
  verdictFor: (questionNumber: number) => "correct" | "incorrect" | undefined;
  reviewMode: boolean;
  onSelectQuestion: (question: number) => void;
}) {
  const all = parts.flatMap((part) => part.questions);
  const at = all.indexOf(activeQuestion);
  const previous = at > 0 ? all[at - 1] : null;
  const next = at >= 0 && at < all.length - 1 ? all[at + 1] : null;

  const strip = useRef<HTMLDivElement>(null);
  const currentChip = useRef<HTMLButtonElement>(null);

  /**
   * Keep the current question in the strip. On a narrow screen the numbers
   * scroll sideways, so stepping past the edge would otherwise leave a student
   * looking at a bar that no longer says where they are. Only the strip's own
   * scroll moves — `scrollIntoView` would drag ancestors with it.
   */
  useEffect(() => {
    const box = strip.current;
    const chip = currentChip.current;
    if (!box || !chip) return;

    const bounds = box.getBoundingClientRect();
    const mark = chip.getBoundingClientRect();
    const margin = 12;

    if (mark.left < bounds.left) box.scrollLeft -= bounds.left - mark.left + margin;
    else if (mark.right > bounds.right) box.scrollLeft += mark.right - bounds.right + margin;
  }, [activeQuestion, activePart]);

  /** Done in a part: answered while sitting the test, correct while reviewing. */
  const doneIn = (part: NavPart) =>
    part.questions.filter((question) =>
      reviewMode
        ? verdictFor(question) === "correct"
        : Boolean((answers[String(question)] ?? "").trim()),
    ).length;

  return (
    <nav
      aria-label="Question navigator"
      className="flex flex-none items-center gap-2 border-t border-ink/[0.12] bg-white px-3 py-2 lg:px-[18px]"
    >
      <div ref={strip} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {parts.map((part) =>
          part.number === activePart ? (
            <div
              key={part.number}
              className="flex flex-none items-center gap-3 rounded-lg bg-surface-alt py-1.5 pl-3 pr-2"
            >
              <span className="text-[12.5px] font-bold text-ink">Part {part.number}</span>
              <ul className="flex items-center gap-0.5">
                {part.questions.map((question) => (
                  <li key={question}>
                    <Chip
                      ref={activeQuestion === question ? currentChip : undefined}
                      number={question}
                      answered={Boolean((answers[String(question)] ?? "").trim())}
                      current={activeQuestion === question}
                      flagged={flags.includes(question)}
                      verdict={verdictFor(question)}
                      reviewMode={reviewMode}
                      onClick={() => onSelectQuestion(question)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <button
              key={part.number}
              type="button"
              onClick={() => onSelectQuestion(part.questions[0])}
              aria-label={`Part ${part.number}, ${doneIn(part)} of ${part.questions.length} ${
                reviewMode ? "correct" : "answered"
              }`}
              className="flex flex-none items-center gap-2 rounded-lg px-3 py-1.5 transition hover:bg-surface-alt"
            >
              <span className="text-[12.5px] font-bold text-ink-muted">Part {part.number}</span>
              <span aria-hidden className="text-[12.5px] tabular-nums text-ink-subtle">
                {doneIn(part)} of {part.questions.length}
              </span>
            </button>
          ),
        )}
      </div>

      <div className="flex flex-none items-center gap-1">
        <Step
          label="Previous question"
          disabled={previous === null}
          onClick={() => previous !== null && onSelectQuestion(previous)}
        />
        <Step
          label="Next question"
          forward
          disabled={next === null}
          onClick={() => next !== null && onSelectQuestion(next)}
        />
      </div>
    </nav>
  );
}

function Chip({
  ref,
  number,
  answered,
  current,
  flagged,
  verdict,
  reviewMode,
  onClick,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  number: number;
  answered: boolean;
  current: boolean;
  flagged: boolean;
  verdict?: "correct" | "incorrect";
  reviewMode: boolean;
  onClick: () => void;
}) {
  const rule =
    verdict === "correct"
      ? "bg-ok"
      : verdict === "incorrect"
        ? "bg-brand-red-cta"
        : current
          ? "bg-brand-blue"
          : "bg-ink";

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-current={current ? "true" : undefined}
      aria-label={`Question ${number}${answered ? ", answered" : ""}${flagged ? ", flagged" : ""}${
        verdict ? `, ${verdict}` : ""
      }`}
      className={cn(
        "relative flex h-[28px] min-w-[28px] items-center justify-center rounded px-1 text-[12.5px] font-semibold tabular-nums transition",
        "text-ink hover:bg-ink/[0.07]",
        verdict === "correct" && "text-ok",
        verdict === "incorrect" && "text-brand-red-cta",
        current && "text-brand-blue shadow-[inset_0_0_0_1.5px_#0154f8]",
        reviewMode && !verdict && "text-ink-subtle",
      )}
    >
      {number}

      {answered && (
        <span
          aria-hidden
          className={cn("absolute inset-x-[5px] bottom-[3px] h-[2px] rounded-full", rule)}
        />
      )}

      {flagged && (
        <span
          aria-hidden
          className="absolute -right-px -top-px h-[6px] w-[6px] rounded-full bg-brand-red ring-2 ring-white"
        />
      )}
    </button>
  );
}

function Step({
  label,
  forward,
  disabled,
  onClick,
}: {
  label: string;
  forward?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-surface-alt text-ink transition hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-30"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={forward ? undefined : "rotate-180"}
      >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </svg>
    </button>
  );
}
