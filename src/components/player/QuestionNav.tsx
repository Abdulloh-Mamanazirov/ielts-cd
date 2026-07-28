"use client";

import { cn } from "@/lib/utils";

export type NavPart = { number: number; questions: number[] };

/**
 * Every part is visible at once — a student jumping back to part 1 should not
 * have to change section first. Four states: navy answered, outline not yet,
 * blue current, red dot flagged.
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
  const answered = all.filter((q) => (answers[String(q)] ?? "").trim()).length;

  return (
    <nav
      aria-label="Question navigator"
      className="flex-none border-t border-ink/[0.12] bg-white px-4 pb-3 pt-2.5 lg:px-[22px]"
    >
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {parts.map((part, index) => (
          <div key={part.number} className="flex flex-none items-center gap-2">
            {index > 0 && <span aria-hidden className="h-[30px] w-px flex-none bg-ink/[0.14]" />}
            <span
              className={cn(
                "text-[9px] font-bold tracking-[0.13em]",
                part.number === activePart ? "text-brand-blue" : "text-ink/[0.42]",
              )}
            >
              PART {part.number}
            </span>
            <ul className="flex gap-1">
              {part.questions.map((question) => (
                <li key={question}>
                  <Chip
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
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-4 border-t border-ink/[0.08] pt-2.5">
        <Legend swatch="bg-ink" label={`Answered ${answered}`} />
        <Legend
          swatch="bg-white shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.22)]"
          label={`Left ${all.length - answered}`}
        />
        <Legend
          swatch="bg-white shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.22)]"
          dot
          label={`Flagged ${flags.length}`}
        />
        <Legend swatch="bg-brand-blue" label={`Current question ${activeQuestion}`} />
      </div>
    </nav>
  );
}

function Chip({
  number,
  answered,
  current,
  flagged,
  verdict,
  reviewMode,
  onClick,
}: {
  number: number;
  answered: boolean;
  current: boolean;
  flagged: boolean;
  verdict?: "correct" | "incorrect";
  reviewMode: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? "true" : undefined}
      aria-label={`Question ${number}${answered ? ", answered" : ""}${flagged ? ", flagged" : ""}${
        verdict ? `, ${verdict}` : ""
      }`}
      className={cn(
        "relative flex h-[30px] w-[30px] items-center justify-center rounded text-[12px] font-bold transition",
        !reviewMode && answered && "bg-ink text-white",
        !reviewMode &&
          !answered &&
          "bg-white text-ink shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.22)] hover:shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.45)]",
        verdict === "correct" && "bg-ok text-white",
        verdict === "incorrect" && "bg-brand-red-cta text-white",
        current && "bg-brand-blue text-white",
      )}
    >
      {number}
      {flagged && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] rounded-full bg-brand-red ring-2 ring-white"
        />
      )}
    </button>
  );
}

function Legend({ swatch, label, dot }: { swatch: string; label: string; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink/60">
      <span aria-hidden className={cn("relative h-[13px] w-[13px] rounded", swatch)}>
        {dot && (
          <span className="absolute -right-0.5 -top-0.5 block h-[7px] w-[7px] rounded-full bg-brand-red" />
        )}
      </span>
      {label}
    </span>
  );
}
