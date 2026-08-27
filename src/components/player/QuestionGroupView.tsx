"use client";

import { useCallback } from "react";

import type { QuestionGroup } from "@/lib/tests/schema";
import { cn } from "@/lib/utils";
import { AnswerInput } from "./AnswerInput";
import { AnswerOption, type OptionMark } from "./AnswerOption";
import { Explanation } from "./Explanation";
import { MatchingBoard } from "./MatchingBoard";
import { RichHtml, SlotHtml } from "./SlotHtml";

export { Explanation };

const FIXED_CHOICES: Record<string, string[]> = {
  tfng: ["TRUE", "FALSE", "NOT GIVEN"],
  ynng: ["YES", "NO", "NOT GIVEN"],
};

export type ReviewInfo = {
  correct: boolean;
  expected: string;
  allAccepted: string[];
  submitted: string;
  explanation?: string;
  evidence?: { anchor?: string; snippet?: string };
  overWordLimit?: boolean;
};

export type GroupViewProps = {
  group: QuestionGroup;
  answers: Record<string, string>;
  flags: number[];
  activeQuestion: number;
  reviewMode: boolean;
  reviewFor: (questionNumber: number) => ReviewInfo | undefined;
  onAnswer: (questionNumber: number, value: string) => void;
  onFocusQuestion: (questionNumber: number) => void;
  onToggleFlag: (questionNumber: number) => void;
  onShowEvidence?: (evidence: { anchor?: string; snippet?: string }) => void;
};

/**
 * A matching group is a drag-and-drop board — but only in the shape the board
 * knows how to draw: numbered items, one letter each, chosen from a shared box.
 * A matching group written as a summary with slots, or one asking for two
 * letters per item, falls back to the list rendering rather than being forced
 * into a layout that cannot express it.
 */
function isDragBoard(group: QuestionGroup): boolean {
  return (
    group.type === "matching" &&
    group.selectCount === 1 &&
    !group.bodyHtml &&
    (group.wordBank?.length ?? 0) > 0 &&
    (group.questions?.length ?? 0) > 0
  );
}

export function QuestionGroupView(props: GroupViewProps) {
  const { group } = props;

  return (
    <section className="mb-9 scroll-mt-6" data-group={group.id}>
      {/* The rubric is set as plain exam prose — no rule, no tint, no shrunken
          grey. In the real test the instructions read at the same weight as the
          questions, and students are told to read them that carefully. */}
      <RichHtml
        html={group.rubricHtml}
        className="mb-4 text-[0.95em] leading-relaxed text-ink [&_h3]:mb-1.5 [&_h3]:text-[1.08em] [&_h3]:font-bold [&_h3]:text-ink [&_p]:mt-1.5 [&_strong]:font-bold [&_strong]:text-ink"
      />

      {group.type === "map_labeling" ? (
        <MapLabelling {...props} />
      ) : isDragBoard(group) ? (
        // The board draws its own answer box, so no separate word bank above it.
        <MatchingBoard {...props} />
      ) : (
        <>
          {group.wordBank && group.wordBank.length > 0 && <WordBank group={group} />}
          {group.bodyHtml ? <CompletionBody {...props} /> : <ItemList {...props} />}
        </>
      )}
    </section>
  );
}

/**
 * The question number, in the exam's own idiom: bold, plain, in the margin.
 * It only becomes a coloured chip in review, where the screen is no longer
 * pretending to be the test and a verdict is the point.
 */
function QuestionNumber({
  label,
  verdict,
}: {
  label: string;
  verdict?: "correct" | "incorrect";
}) {
  return (
    <span
      className={cn(
        "flex-none select-none font-bold tabular-nums",
        !verdict && "min-w-[1.6em] text-ink",
        verdict === "correct" && "rounded bg-ok px-1.5 py-0.5 text-[0.82em] text-white",
        verdict === "incorrect" &&
          "rounded bg-brand-red-cta px-1.5 py-0.5 text-[0.82em] text-white",
      )}
    >
      {label}
    </span>
  );
}

/**
 * Map and diagram labelling. The letters are positions on the image, not
 * choices with text, so they render as a compact row of chips per item — a full
 * option row each would mean fifty-odd rows for a six-label map.
 */
function MapLabelling({
  group,
  answers,
  activeQuestion,
  reviewMode,
  reviewFor,
  onAnswer,
  onFocusQuestion,
}: GroupViewProps) {
  const letters = (group.wordBank ?? []).map((item) => item.letter);

  return (
    <div>
      {group.imageUrl && (
        /* eslint-disable-next-line @next/next/no-img-element -- maps and
           diagrams are arbitrary uploaded artwork with no known intrinsic
           size, which next/image requires. */
        <img
          src={group.imageUrl}
          alt="Map to label"
          className="mb-6 w-full max-w-2xl rounded-[10px] bg-white"
        />
      )}

      <ol className="space-y-1.5">
        {group.questions?.map((question) => {
          const review = reviewFor(question.number);
          const value = (answers[String(question.number)] ?? "").toUpperCase();

          return (
            <li
              key={question.number}
              id={`q${question.number}`}
              className={cn(
                "relative flex flex-wrap items-center gap-3 rounded-md py-1.5 transition",
                review?.correct && "bg-ok-soft px-2",
                review && !review.correct && "bg-bad-soft px-2",
              )}
            >
              {activeQuestion === question.number && !reviewMode && <ActiveRule />}

              <QuestionNumber
                label={String(question.number)}
                verdict={review ? (review.correct ? "correct" : "incorrect") : undefined}
              />

              {/* Not flex-1: letting the label grow pushed the answer letters
                  to the far right, leaving a wide gap between each place name
                  and its options. Sitting them next to the label reads better. */}
              <span className="min-w-0 text-ink">{question.textHtml}</span>

              <span className="flex flex-wrap gap-1">
                {letters.map((letter) => {
                  const chosen = value === letter;
                  const isRight =
                    review?.allAccepted.some((a) => a.trim().toUpperCase() === letter) ?? false;

                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={reviewMode}
                      aria-pressed={chosen}
                      aria-label={`Question ${question.number}, option ${letter}`}
                      onClick={() => {
                        onFocusQuestion(question.number);
                        onAnswer(question.number, chosen ? "" : letter);
                      }}
                      className={cn(
                        "h-8 w-8 rounded text-xs font-bold transition",
                        !review &&
                          (chosen
                            ? "bg-brand-blue text-white"
                            : "bg-white text-ink shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.25)] hover:shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.55)]"),
                        review && chosen && isRight && "bg-ok text-white",
                        review && chosen && !isRight && "bg-brand-red-cta text-white",
                        review && !chosen && isRight && "bg-ok/20 text-ok shadow-[inset_0_0_0_1.5px_#0b7a52]",
                        review && !chosen && !isRight && "bg-white text-ink-subtle",
                      )}
                    >
                      {letter}
                    </button>
                  );
                })}
              </span>

              {review && !review.correct && (
                <span className="w-full text-xs font-bold text-ok">
                  Correct answer: {review.expected}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Where the student is, marked in the margin rather than by repainting the
 * question. A block of colour behind the current question is a thing the real
 * test never does, and it fights the passage for attention.
 */
function ActiveRule() {
  return (
    <span
      aria-hidden
      className="absolute -left-3 top-0 h-full w-[3px] rounded-full bg-brand-blue"
    />
  );
}

function WordBank({ group }: { group: QuestionGroup }) {
  return (
    <ul className="mb-5 grid gap-x-6 gap-y-1.5 rounded-md bg-surface-alt px-4 py-3.5 text-[0.95em] sm:grid-cols-2">
      {group.wordBank?.map((item) => {
        // Same guard as AnswerOption: never print the control letter twice when
        // a source stores it as the entry's whole text.
        const isBareLetter =
          item.textHtml.replace(/<[^>]*>/g, "").trim().toUpperCase() ===
          item.letter.trim().toUpperCase();

        return (
          <li key={item.letter} className="flex gap-2.5">
            {!isBareLetter && (
              <span className="w-[0.9em] flex-none font-bold text-ink">{item.letter}</span>
            )}
            <RichHtml html={item.textHtml} className="text-ink" />
          </li>
        );
      })}
    </ul>
  );
}

function CompletionBody({
  group,
  answers,
  activeQuestion,
  reviewMode,
  reviewFor,
  onAnswer,
  onFocusQuestion,
  onShowEvidence,
}: GroupViewProps) {
  const letterOnly = Boolean(group.wordBank && group.wordBank.length > 0);

  // The completion slots are inline in the body HTML, so there is no per-question
  // panel to hang the evidence off. In a listening test (no passage to jump to,
  // hence no onShowEvidence) we instead list the recording lines for the answers
  // the student missed, below the notes -- the spoken-word proof they would get
  // from a highlighted passage in reading.
  const recordingLines =
    reviewMode && !onShowEvidence
      ? [...new Set([...(group.bodyHtml ?? "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1])))]
          .map((n) => ({ n, review: reviewFor(n) }))
          .filter((x) => x.review && !x.review.correct && x.review.evidence?.snippet)
      : [];

  const renderSlot = useCallback(
    (questionNumber: number) => {
      const review = reviewFor(questionNumber);
      return (
        <AnswerInput
          questionNumber={questionNumber}
          value={answers[String(questionNumber)] ?? ""}
          onChange={(value) => onAnswer(questionNumber, value)}
          onFocus={() => onFocusQuestion(questionNumber)}
          isActive={activeQuestion === questionNumber}
          verdict={review ? (review.correct ? "correct" : "incorrect") : undefined}
          expected={review && !review.correct ? review.expected : undefined}
          letterOnly={letterOnly}
          disabled={reviewMode}
        />
      );
    },
    [answers, activeQuestion, reviewMode, letterOnly, onAnswer, onFocusQuestion, reviewFor],
  );

  return (
    <div className="question-body leading-8 text-ink [&_li]:py-1 [&_.flow-arrow]:my-1 [&_.flow-arrow]:text-center [&_.flow-arrow]:text-brand-blue [&_.flow-box]:rounded-md [&_.flow-box]:bg-surface-alt [&_.flow-box]:px-4 [&_.flow-box]:py-3 [&_.form-label]:font-semibold [&_.form-row]:flex [&_.form-row]:flex-wrap [&_.form-row]:gap-x-3 [&_.form-row]:border-b [&_.form-row]:border-rule [&_.form-row]:py-2 [&_.notes-list]:list-disc [&_.notes-list]:pl-5 [&_.q-table]:w-full [&_.q-table_td]:border [&_.q-table_td]:border-rule [&_.q-table_td]:p-2.5 [&_.q-table_th]:border [&_.q-table_th]:border-rule [&_.q-table_th]:bg-surface-alt [&_.q-table_th]:p-2.5 [&_.q-table_th]:text-left [&_.summary-title]:mb-2 [&_.summary-title]:font-bold">
      <SlotHtml html={group.bodyHtml ?? ""} renderSlot={renderSlot} />

      {recordingLines.length > 0 && (
        <figure className="mt-4 rounded-[10px] border-l-[3px] border-brand-blue/40 bg-surface-alt px-4 py-3 leading-relaxed">
          <figcaption className="text-[10px] font-bold tracking-[0.16em] text-ink-subtle">
            IN THE RECORDING
          </figcaption>
          <ul className="mt-1.5 space-y-1.5">
            {recordingLines.map(({ n, review }) => (
              <li key={n} className="flex gap-2 text-sm text-ink">
                <span className="flex-none font-bold text-brand-blue">{n}</span>
                <span className="italic">“{review!.evidence!.snippet}”</span>
              </li>
            ))}
          </ul>
        </figure>
      )}
    </div>
  );
}

function ItemList(props: GroupViewProps) {
  const { group } = props;
  const fixed = FIXED_CHOICES[group.type];

  return (
    <ol className="space-y-6">
      {group.questions?.map((question) => {
        const options =
          fixed?.map((value) => ({ letter: value, textHtml: value })) ??
          question.options ??
          group.wordBank ??
          [];

        return (
          <li key={question.number} id={`q${question.number}`} className="scroll-mt-6">
            <QuestionItem
              {...props}
              number={question.number}
              textHtml={question.textHtml}
              options={options}
              // TRUE/FALSE/NOT GIVEN and YES/NO/NOT GIVEN are the answer, so
              // printing a letter beside them would be printing it twice.
              useLetterBadge={!fixed}
            />
          </li>
        );
      })}
    </ol>
  );
}

function QuestionItem({
  number,
  textHtml,
  options,
  useLetterBadge,
  group,
  answers,
  flags,
  activeQuestion,
  reviewMode,
  reviewFor,
  onAnswer,
  onFocusQuestion,
  onToggleFlag,
  onShowEvidence,
}: GroupViewProps & {
  number: number;
  textHtml?: string;
  options: Array<{ letter: string; textHtml: string }>;
  useLetterBadge: boolean;
}) {
  const numbers = Array.from({ length: group.selectCount }, (_, offset) => number + offset);
  const selected = numbers.map((value) => answers[String(value)] ?? "").filter(Boolean);
  const isMulti = group.selectCount > 1;
  const review = reviewFor(number);
  const accepted = review?.allAccepted.map((value) => value.trim().toUpperCase()) ?? [];
  const isHere = activeQuestion >= number && activeQuestion <= number + group.selectCount - 1;

  const toggleMulti = (letter: string) => {
    const next = selected.includes(letter)
      ? selected.filter((value) => value !== letter)
      : [...selected, letter].slice(-group.selectCount);
    numbers.forEach((questionNumber, index) => onAnswer(questionNumber, next[index] ?? ""));
  };

  const markFor = (letter: string): OptionMark => {
    if (!review) return null;
    const chosen = isMulti
      ? selected.includes(letter)
      : (answers[String(number)] ?? "").trim().toUpperCase() === letter.toUpperCase();
    const isRight = accepted.includes(letter.trim().toUpperCase());

    if (chosen && isRight) return "correct";
    if (chosen && !isRight) return "chosen-wrong";
    if (!chosen && isRight) return "missed";
    return null;
  };

  return (
    <div className="relative" onFocus={() => onFocusQuestion(number)}>
      {isHere && !reviewMode && <ActiveRule />}

      <div className="mb-2 flex items-start gap-2.5">
        <QuestionNumber
          label={isMulti ? `${number}–${number + group.selectCount - 1}` : String(number)}
          verdict={review ? (review.correct ? "correct" : "incorrect") : undefined}
        />

        {textHtml && <RichHtml html={textHtml} className="flex-1 leading-relaxed text-ink" />}

        {!reviewMode && (
          <button
            type="button"
            onClick={() => onToggleFlag(number)}
            aria-pressed={flags.includes(number)}
            aria-label={`Flag question ${number} for review`}
            className={cn(
              "flex h-7 w-7 flex-none items-center justify-center rounded transition",
              flags.includes(number)
                ? "bg-brand-red text-white"
                : "text-ink-faint hover:bg-surface-alt hover:text-ink-muted",
            )}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={flags.includes(number) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
              <path d="M6 3v18l6-4.5 6 4.5V3z" />
            </svg>
          </button>
        )}
      </div>

      {/* Indented to sit under the question text, not under its number. */}
      <div className="pl-6">
        {options.map((option) => (
          <AnswerOption
            key={option.letter}
            letter={option.letter}
            textHtml={option.textHtml}
            showLetter={useLetterBadge}
            checked={
              isMulti
                ? selected.includes(option.letter)
                : answers[String(number)] === option.letter
            }
            multi={isMulti}
            name={`q${number}`}
            disabled={reviewMode}
            mark={markFor(option.letter)}
            onSelect={() =>
              isMulti ? toggleMulti(option.letter) : onAnswer(number, option.letter)
            }
          />
        ))}
      </div>

      {review && !review.correct && (
        <Explanation review={review} onShowEvidence={onShowEvidence} />
      )}
    </div>
  );
}
