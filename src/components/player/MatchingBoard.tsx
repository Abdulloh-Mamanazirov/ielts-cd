"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { htmlToText } from "@/lib/player/highlights";
import { cn } from "@/lib/utils";
import { Explanation } from "./Explanation";
import type { GroupViewProps } from "./QuestionGroupView";
import { RichHtml } from "./SlotHtml";

/**
 * A drag-and-drop matching task, the way the computer-delivered test sets one:
 * the items down the left, the box of answers on the right, and an answer
 * dragged into place.
 *
 * The rubrics in the source material say so literally — "drag the correct topic
 * next to questions 15–20" — and rendering them as six repeats of the same
 * seven-option radio list was both unlike the exam and enormous.
 *
 * Dragging is not the only way in, and deliberately so: HTML drag events never
 * fire on a touchscreen, and a student on a phone or using a keyboard has to be
 * able to sit the test. So the primary interaction is **pick up, then place** —
 * click or Enter on an answer, then on a question. Native dragging is layered
 * over the top for people who reach for it. Both routes end in the same call.
 *
 * Nothing new is stored: the answer is still the letter, so grading, autosave,
 * the navigator and review are untouched.
 */

/**
 * "Which section contains …" banks hold nothing but the section labels, so the
 * entry's text is the letter itself. Printing both the control letter and the
 * text then shows "A A". Same guard as WordBank in QuestionGroupView.
 */
const isBareLetter = (letter: string, label: string) =>
  label.trim().toUpperCase() === letter.trim().toUpperCase();

export function MatchingBoard({
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
}: GroupViewProps) {
  const bank = useMemo(() => group.wordBank ?? [], [group.wordBank]);
  const questions = useMemo(() => group.questions ?? [], [group.questions]);

  /** The answer currently in hand, picked up by click or by dragging. */
  const [held, setHeld] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [said, setSaid] = useState("");

  const textFor = useCallback(
    (letter: string) => htmlToText(bank.find((item) => item.letter === letter)?.textHtml ?? ""),
    [bank],
  );

  const placed = questions.filter((q) => (answers[String(q.number)] ?? "").trim()).length;
  const used = new Set(
    questions.map((q) => (answers[String(q.number)] ?? "").trim()).filter(Boolean),
  );

  // Escape puts down whatever is in hand, which is the way out of a half-made
  // move without having to guess where it is safe to click.
  useEffect(() => {
    if (held === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setHeld(null);
      setSaid("Put down.");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [held]);

  const place = useCallback(
    (questionNumber: number, letter: string) => {
      onAnswer(questionNumber, letter);
      onFocusQuestion(questionNumber);
      setHeld(null);
      setOver(null);
      setSaid(`${textFor(letter)} placed at question ${questionNumber}.`);
    },
    [onAnswer, onFocusQuestion, textFor],
  );

  const takeFrom = useCallback(
    (questionNumber: number, letter: string) => {
      onAnswer(questionNumber, "");
      onFocusQuestion(questionNumber);
      setHeld(letter);
      setSaid(`Picked up ${textFor(letter)}. Choose a question, or press Escape to put it back.`);
    },
    [onAnswer, onFocusQuestion, textFor],
  );

  if (bank.length === 0 || questions.length === 0) return null;

  return (
    <div className="@container">
      <p aria-live="polite" className="sr-only">
        {said}
      </p>

      {!reviewMode && (
        <p className="mb-3 text-[0.85em] text-ink-subtle">
          {held
            ? `Holding “${textFor(held)}”. Choose a question, or press Escape to put it back.`
            : "Drag an answer into a box — or tap the answer, then tap the question."}
        </p>
      )}

      <div className="grid gap-x-6 gap-y-5 @2xl:grid-cols-2">
        <ol className="space-y-2.5">
          {questions.map((question) => {
            const letter = (answers[String(question.number)] ?? "").trim();
            const review = reviewFor(question.number);

            return (
              <li key={question.number} id={`q${question.number}`} className="relative scroll-mt-6">
                {activeQuestion === question.number && !reviewMode && (
                  <span
                    aria-hidden
                    className="absolute -left-3 top-0 h-full w-[3px] rounded-full bg-brand-blue"
                  />
                )}

                <div className="flex flex-col gap-1.5 @md:flex-row @md:items-center @md:gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <span className="min-w-[1.6em] flex-none font-bold tabular-nums text-ink">
                      {question.number}
                    </span>
                    {/* The item label is not inside a button, so it can keep
                        whatever emphasis the source gave it. The answers cannot
                        — a button may only hold phrasing content. */}
                    <RichHtml
                      html={question.textHtml ?? ""}
                      className="min-w-0 flex-1 text-ink"
                    />

                    {!reviewMode && (
                      <FlagButton
                        number={question.number}
                        on={flags.includes(question.number)}
                        onClick={() => onToggleFlag(question.number)}
                      />
                    )}
                  </div>

                  <Zone
                    number={question.number}
                    letter={letter}
                    label={letter ? textFor(letter) : ""}
                    held={held}
                    over={over === question.number}
                    reviewMode={reviewMode}
                    correct={review?.correct}
                    onDropLetter={(dropped) => place(question.number, dropped)}
                    onEnter={() => setOver(question.number)}
                    onLeave={() => setOver((current) => (current === question.number ? null : current))}
                    onActivate={() => {
                      if (held) place(question.number, held);
                      else if (letter) takeFrom(question.number, letter);
                      else {
                        onFocusQuestion(question.number);
                        setSaid("Choose an answer from the box first.");
                      }
                    }}
                  />
                </div>

                {review && !review.correct && (
                  <>
                    <p className="mt-1.5 text-[0.85em] font-bold text-ok @md:pl-[1.6em]">
                      <span aria-hidden>→ </span>
                      {review.expected} {textFor(review.expected)}
                    </p>
                    <Explanation review={review} onShowEvidence={onShowEvidence} />
                  </>
                )}
              </li>
            );
          })}
        </ol>

        {/*
          Side by side there is room for the box on the right, kept sticky so it
          is still there once the list runs past a screen. Stacked, it goes
          above the questions instead — that is the order the paper test reads
          in, and a box below the list is a box nobody scrolls to.
        */}
        <div className="order-first self-start @2xl:order-none @2xl:sticky @2xl:top-0">
          <p className="mb-2 flex items-baseline justify-between gap-3 text-[10px] font-bold tracking-[0.16em] text-ink-subtle">
            ANSWERS
            <span className="tabular-nums">
              {placed} OF {questions.length} PLACED
            </span>
          </p>

          <ul className="space-y-1">
            {bank.map((item) => (
              <li key={item.letter}>
                <BankOption
                  letter={item.letter}
                  label={htmlToText(item.textHtml)}
                  held={held === item.letter}
                  // Used answers stay pickable. Some matching rubrics allow a
                  // letter more than once, and we cannot tell which from the
                  // content — blocking a legitimate reuse costs a real mark,
                  // while greying it is enough of a nudge for the ones that do
                  // not.
                  used={used.has(item.letter)}
                  reviewMode={reviewMode}
                  onPick={() => {
                    const next = held === item.letter ? null : item.letter;
                    setHeld(next);
                    setSaid(
                      next
                        ? `Picked up ${htmlToText(item.textHtml)}. Choose a question.`
                        : "Put down.",
                    );
                  }}
                  onDragEnd={() => setOver(null)}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const DRAG_TYPE = "text/x-ielts-answer";

function Zone({
  number,
  letter,
  label,
  held,
  over,
  reviewMode,
  correct,
  onDropLetter,
  onEnter,
  onLeave,
  onActivate,
}: {
  number: number;
  letter: string;
  label: string;
  held: string | null;
  over: boolean;
  reviewMode: boolean;
  correct?: boolean;
  onDropLetter: (letter: string) => void;
  onEnter: () => void;
  onLeave: () => void;
  onActivate: () => void;
}) {
  const filled = letter.length > 0;

  return (
    <button
      type="button"
      disabled={reviewMode}
      onClick={onActivate}
      onDragOver={(event) => {
        if (reviewMode) return;
        // Without preventDefault the browser refuses the drop outright.
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onEnter();
      }}
      onDragLeave={onLeave}
      onDrop={(event) => {
        if (reviewMode) return;
        event.preventDefault();
        const dropped =
          event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData("text/plain");
        if (dropped) onDropLetter(dropped);
      }}
      aria-label={
        filled
          ? `Question ${number}, answered ${label}`
          : held
            ? `Question ${number}, empty. Place the answer you are holding here`
            : `Question ${number}, empty`
      }
      className={cn(
        "flex min-h-[40px] w-full items-center gap-2.5 rounded-md border-2 px-3 py-1.5 text-left text-[0.95em] transition @md:w-[54%] @md:flex-none",
        !filled && "border-dashed border-ink/25",
        filled && "border-solid border-ink/35 bg-white",
        // Wrong answers are outlined, never filled red. A block of red behind
        // a student's own words reads as a telling-off rather than a mark.
        correct === true && "border-solid border-ok bg-ok-soft",
        correct === false && "border-solid border-brand-red-cta",
        !reviewMode && held !== null && !over && "border-brand-blue/45",
        over && "border-solid border-brand-blue bg-brand-blue-soft",
      )}
    >
      {filled ? (
        <>
          <span className="flex-none font-bold text-ink">{letter}</span>
          {!isBareLetter(letter, label) && (
            <span
              className={cn(
                "min-w-0 flex-1",
                correct === false ? "text-brand-red-cta line-through" : "text-ink",
              )}
            >
              {label}
            </span>
          )}
        </>
      ) : (
        <span className="w-full text-center font-bold tabular-nums text-ink-subtle">{number}</span>
      )}
    </button>
  );
}

function BankOption({
  letter,
  label,
  held,
  used,
  reviewMode,
  onPick,
  onDragEnd,
}: {
  letter: string;
  label: string;
  held: boolean;
  used: boolean;
  reviewMode: boolean;
  onPick: () => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      disabled={reviewMode}
      draggable={!reviewMode}
      aria-pressed={held}
      onClick={onPick}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, letter);
        // Plain text as well, so a drop landing anywhere else is at least sane.
        event.dataTransfer.setData("text/plain", letter);
        event.dataTransfer.effectAllowed = "move";
        if (!held) onPick();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md border-2 border-transparent bg-surface-alt px-3 py-2 text-left text-[0.95em] transition",
        !reviewMode && "cursor-grab hover:bg-ink/[0.08]",
        used && !held && "opacity-45",
        held && "cursor-grabbing border-brand-blue bg-brand-blue-soft opacity-100",
      )}
    >
      <span className="w-[0.9em] flex-none font-bold text-ink">{letter}</span>
      {!isBareLetter(letter, label) && (
        <span className="min-w-0 flex-1 text-ink">{label}</span>
      )}
    </button>
  );
}

function FlagButton({
  number,
  on,
  onClick,
}: {
  number: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={`Flag question ${number} for review`}
      className={cn(
        "flex h-7 w-7 flex-none items-center justify-center rounded transition",
        on ? "bg-brand-red text-white" : "text-ink-faint hover:bg-surface-alt hover:text-ink-muted",
      )}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
        <path d="M6 3v18l6-4.5 6 4.5V3z" />
      </svg>
    </button>
  );
}
