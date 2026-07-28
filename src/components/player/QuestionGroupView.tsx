"use client";

import { useCallback } from "react";

import type { QuestionGroup } from "@/lib/tests/schema";
import { cn } from "@/lib/utils";
import { AnswerInput } from "./AnswerInput";
import { OptionPill, type OptionMark } from "./OptionPill";
import { RichHtml, SlotHtml } from "./SlotHtml";

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

export function QuestionGroupView(props: GroupViewProps) {
  const { group } = props;

  return (
    <section className="mb-10 scroll-mt-6" data-group={group.id}>
      <RichHtml
        html={group.rubricHtml}
        className="mb-5 border-l-2 border-brand-blue pl-4 text-sm leading-relaxed text-ink-muted [&_h3]:mb-1 [&_h3]:font-display [&_h3]:text-base [&_h3]:text-ink [&_strong]:text-ink"
      />

      {group.type === "map_labeling" ? (
        <MapLabelling {...props} />
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
 * Map and diagram labelling. The letters are positions on the image, not
 * choices with text, so they render as a compact row of chips per item — a full
 * option pill each would mean fifty-odd pills for a six-label map.
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

      <ol className="space-y-2">
        {group.questions?.map((question) => {
          const review = reviewFor(question.number);
          const value = (answers[String(question.number)] ?? "").toUpperCase();

          return (
            <li
              key={question.number}
              id={`q${question.number}`}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-[10px] px-3 py-2 transition",
                activeQuestion === question.number && !reviewMode && "bg-brand-blue-soft/60",
                review?.correct && "bg-ok-soft",
                review && !review.correct && "bg-bad-soft",
              )}
            >
              <span
                className={cn(
                  "flex h-[26px] flex-none items-center justify-center rounded-md px-2 text-[12.5px] font-bold",
                  review
                    ? review.correct
                      ? "bg-ok text-white"
                      : "bg-brand-red-cta text-white"
                    : "text-ink shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.22)]",
                )}
              >
                {question.number}
              </span>

              <span className="min-w-0 flex-1 text-sm text-ink">{question.textHtml}</span>

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
                            : "bg-white text-ink shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.2)] hover:shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.5)]"),
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

function WordBank({ group }: { group: QuestionGroup }) {
  return (
    <ul className="mb-5 grid gap-x-5 gap-y-1.5 rounded-[10px] bg-surface-alt p-4 text-sm sm:grid-cols-2">
      {group.wordBank?.map((item) => (
        <li key={item.letter} className="flex gap-2.5">
          <span className="font-bold text-brand-blue">{item.letter}</span>
          <RichHtml html={item.textHtml} className="text-ink-muted" />
        </li>
      ))}
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
}: GroupViewProps) {
  const letterOnly = Boolean(group.wordBank && group.wordBank.length > 0);

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
    <div className="question-body leading-8 text-ink [&_.flow-arrow]:my-1 [&_.flow-arrow]:text-center [&_.flow-arrow]:text-brand-blue [&_.flow-box]:rounded-[10px] [&_.flow-box]:bg-surface-alt [&_.flow-box]:px-4 [&_.flow-box]:py-3 [&_.form-label]:font-semibold [&_.form-row]:flex [&_.form-row]:flex-wrap [&_.form-row]:gap-x-3 [&_.form-row]:border-b [&_.form-row]:border-rule [&_.form-row]:py-2 [&_.notes-list]:list-disc [&_.notes-list]:pl-5 [&_.q-table]:w-full [&_.q-table_td]:border [&_.q-table_td]:border-rule [&_.q-table_td]:p-2.5 [&_.q-table_th]:border [&_.q-table_th]:border-rule [&_.q-table_th]:bg-surface-alt [&_.q-table_th]:p-2.5 [&_.q-table_th]:text-left [&_.summary-title]:mb-2 [&_.summary-title]:font-bold">
      <SlotHtml html={group.bodyHtml ?? ""} renderSlot={renderSlot} />
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
    <div
      className={cn(
        "rounded-[10px] transition",
        !reviewMode &&
          activeQuestion >= number &&
          activeQuestion <= number + group.selectCount - 1 &&
          "bg-brand-blue-soft/60 p-3 -m-3",
      )}
      onFocus={() => onFocusQuestion(number)}
    >
      <div className="mb-3 flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-[26px] flex-none items-center justify-center rounded-md px-2 text-[12.5px] font-bold",
            review
              ? review.correct
                ? "bg-ok text-white"
                : "bg-brand-red-cta text-white"
              : "text-ink shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.22)]",
          )}
        >
          {isMulti ? `${number}–${number + group.selectCount - 1}` : number}
        </span>

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
                : "text-ink-subtle hover:bg-surface-alt",
            )}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={flags.includes(number) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
              <path d="M6 3v18l6-4.5 6 4.5V3z" />
            </svg>
          </button>
        )}
      </div>

      <div className="space-y-2">
        {options.map((option) => (
          <OptionPill
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
