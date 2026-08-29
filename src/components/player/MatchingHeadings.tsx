"use client";

import { createContext, useContext } from "react";

import { htmlToText } from "@/lib/player/highlights";
import type { QuestionGroup } from "@/lib/tests/schema";
import { cn } from "@/lib/utils";
import type { ReviewInfo } from "./QuestionGroupView";
import { RichHtml } from "./SlotHtml";

/**
 * "Matching headings" the way the paper sets it: the numbered box sits in the
 * passage, above the paragraph it belongs to, and the list of headings is a box
 * of draggable cards beside it. A heading is dragged (or, on a touchscreen,
 * tapped then tapped) onto the box.
 *
 * The passage and the headings live in two different panes, so the interaction
 * is shared through a context rather than held inside one board. Native drag
 * events already cross panes on their own; the context carries the "picked up"
 * heading so the tap-to-place route crosses too. Nothing new is stored — the
 * answer is still the heading letter.
 */

// Cambridge labels the lettered blocks of a passage "Paragraph A" in some books
// and "Section A" in others; both mean the same thing to the headings board.
const PARAGRAPH = /(?:paragraph|section)\s+([A-Za-z])\b/i;

/** A `matching` group whose every item is "Paragraph A", "Paragraph B", … */
export function isMatchingHeadings(group: QuestionGroup): boolean {
  const questions = group.questions ?? [];
  return (
    group.type === "matching" &&
    group.selectCount === 1 &&
    !group.bodyHtml &&
    (group.wordBank?.length ?? 0) > 0 &&
    questions.length >= 2 &&
    questions.every((q) => PARAGRAPH.test(htmlToText(q.textHtml ?? "")))
  );
}

/** Paragraph letter → question number, e.g. `{ A: 14, B: 15 }`. */
export function paragraphMap(group: QuestionGroup): Record<string, number> {
  const out: Record<string, number> = {};
  for (const question of group.questions ?? []) {
    const match = PARAGRAPH.exec(htmlToText(question.textHtml ?? ""));
    if (match) out[match[1].toUpperCase()] = question.number;
  }
  return out;
}

export type MatchingHeadingsValue = {
  paraToQnum: Record<string, number>;
  bank: { letter: string; textHtml: string }[];
  answerOf: (qnum: number) => string;
  usedLetters: Set<string>;
  place: (qnum: number, letter: string) => void;
  reviewFor: (qnum: number) => ReviewInfo | undefined;
  reviewMode: boolean;
  activeQuestion: number;
  onFocusQuestion: (qnum: number) => void;
  held: string | null;
  setHeld: (letter: string | null) => void;
};

const Context = createContext<MatchingHeadingsValue | null>(null);
export const MatchingHeadingsProvider = Context.Provider;
export const useMatchingHeadings = () => useContext(Context);

/** MIME type for the dragged heading; a plain-text copy rides along as a fallback. */
const DRAG_TYPE = "application/x-ielts-heading";

function headingText(bank: MatchingHeadingsValue["bank"], letter: string): string {
  const item = bank.find((entry) => entry.letter.toUpperCase() === letter.toUpperCase());
  return item ? htmlToText(item.textHtml) : "";
}

/**
 * The numbered box that renders in the passage, above one paragraph. Given only
 * the paragraph letter — the passage injects it — it reads everything else from
 * the shared context. `data-mh-slot` keeps its text out of the passage's
 * highlight offsets (see PassagePane).
 */
export function HeadingDropSlot({ paraLetter }: { paraLetter: string }) {
  const mh = useMatchingHeadings();
  const qnum = mh?.paraToQnum[paraLetter.toUpperCase()];
  if (!mh || qnum == null) return null;

  const value = mh.answerOf(qnum).toUpperCase();
  const review = mh.reviewFor(qnum);
  const active = mh.activeQuestion === qnum && !mh.reviewMode;

  const drop = (letter: string) => {
    if (mh.reviewMode || !letter) return;
    mh.place(qnum, letter);
    mh.setHeld(null);
  };

  const onClick = () => {
    if (mh.reviewMode) return;
    mh.onFocusQuestion(qnum);
    if (mh.held) drop(mh.held);
    else if (value) mh.place(qnum, ""); // tap a filled box to clear it
  };

  return (
    <div data-mh-slot id={`q${qnum}`} className="mb-2.5 scroll-mt-6 select-none font-sans">
      <div
        role="button"
        tabIndex={mh.reviewMode ? -1 : 0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
        onDragOver={(event) => {
          if (mh.reviewMode) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          drop(event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData("text/plain"));
        }}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.9em] leading-snug transition",
          !mh.reviewMode && "cursor-pointer",
          !review && !value && "border-2 border-dashed border-ink/25 bg-white text-ink-faint",
          !review && value && "bg-brand-blue/10 text-ink shadow-[inset_0_0_0_1.5px_rgba(1,84,248,.35)]",
          !review && active && "ring-2 ring-brand-blue/40",
          !review && mh.held && !value && "border-brand-blue bg-brand-blue/5 text-brand-blue",
          review?.correct && "bg-ok-soft text-ink shadow-[inset_0_0_0_1.5px_#0b7a52]",
          review && !review.correct && "bg-bad-soft text-ink shadow-[inset_0_0_0_1.5px_#e10046]",
        )}
      >
        <span className="flex-none rounded bg-ink px-1.5 py-0.5 text-[0.82em] font-bold tabular-nums text-white">
          {qnum}
        </span>
        {value ? (
          <span>
            <strong className="mr-1.5 text-ink">{value}</strong>
            {headingText(mh.bank, value)}
          </span>
        ) : (
          <span>{mh.held ? "Tap to place the heading here" : "Choose a heading"}</span>
        )}
      </div>

      {review && !review.correct && review.expected && (
        <p className="mt-1 pl-1 text-xs font-bold text-ok">
          Correct: {review.expected.toUpperCase()}
          <span className="font-normal"> — {headingText(mh.bank, review.expected)}</span>
        </p>
      )}
    </div>
  );
}

/** The "List of Headings" box, rendered on the questions side. */
export function HeadingsList({ group }: { group: QuestionGroup }) {
  const mh = useMatchingHeadings();
  if (!mh) return null;
  const bank = group.wordBank ?? [];

  return (
    <div className="rounded-xl bg-surface-alt p-3.5">
      <p className="mb-2.5 text-[0.78em] font-bold uppercase tracking-[0.12em] text-ink-subtle">
        List of Headings
      </p>
      <ul className="space-y-1.5">
        {bank.map((item) => {
          const used = mh.usedLetters.has(item.letter.toUpperCase());
          const held = mh.held === item.letter;
          return (
            <li key={item.letter}>
              <div
                draggable={!mh.reviewMode}
                onDragStart={(event) => {
                  event.dataTransfer.setData(DRAG_TYPE, item.letter);
                  event.dataTransfer.setData("text/plain", item.letter);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => {
                  if (mh.reviewMode) return;
                  mh.setHeld(held ? null : item.letter);
                }}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg px-3 py-2 text-[0.92em] leading-snug transition",
                  mh.reviewMode ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                  !held &&
                    "bg-white text-ink shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.14)] hover:shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.4)]",
                  held && "bg-brand-blue/5 text-ink shadow-[inset_0_0_0_2px_#0154f8]",
                  used && !held && "opacity-45",
                )}
              >
                <span className="flex-none font-bold text-ink">{item.letter.toUpperCase()}</span>
                <RichHtml html={item.textHtml} className="text-inherit" />
              </div>
            </li>
          );
        })}
      </ul>
      {mh.held && (
        <p className="mt-2.5 text-xs font-semibold text-brand-blue">
          Heading {mh.held} picked up — tap a box in the passage to place it.
        </p>
      )}
    </div>
  );
}
