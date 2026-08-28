"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import parse, { type HTMLReactParserOptions } from "html-react-parser";
import { Element as DomElement } from "domhandler";

import { applyHighlightMarks, type Highlight } from "@/lib/player/highlights";
import { cn } from "@/lib/utils";
import { HeadingDropSlot } from "./MatchingHeadings";

export type Evidence = {
  anchor?: string;
  snippet?: string;
  /** Review: the question whose mark to jump to (its badge is `data-qnum`). */
  qnum?: number;
  /** Bumped on every "show me where" click so the same target re-flashes. */
  nonce?: number;
};
/** One answer's location in the passage, for the review "where did this come from" marks. */
export type EvidenceMark = { n: number; snippet: string; correct: boolean };

type Draft = { start: number; end: number; text: string; x: number; y: number };
type OpenNote = { id: string; x: number; y: number };

/**
 * Position of a viewport rect inside a scrolling container.
 *
 * The popovers are absolutely positioned children of the scroller, so their
 * `top` is measured from its *content* box, which scrolls — leaving out
 * scrollTop is what pinned them to the top of the passage however far down the
 * student had read.
 */
function anchorIn(scroller: HTMLElement, box: DOMRect) {
  const bounds = scroller.getBoundingClientRect();
  return {
    x: box.left - bounds.left + scroller.scrollLeft + box.width / 2,
    y: box.top - bounds.top + scroller.scrollTop,
    bottom: box.bottom - bounds.top + scroller.scrollTop,
    left: box.left - bounds.left + scroller.scrollLeft,
  };
}

/**
 * Weaves an answer-location mark, badged with its question number, around every
 * snippet found in the passage. Only snippets belonging to the passage on screen
 * match, so all parts' marks can be passed at once. Overlapping runs keep the
 * earliest; each is a plain first-occurrence find, the same tolerance the single
 * evidence mark uses — a snippet split by a student highlight is simply skipped.
 */
function markEvidenceRuns(html: string, marks: EvidenceMark[]): string {
  const hits = marks
    .map((mark) => ({ ...mark, start: mark.snippet ? html.indexOf(mark.snippet) : -1 }))
    .filter((hit) => hit.start >= 0)
    .map((hit) => ({ ...hit, end: hit.start + hit.snippet.length }))
    .sort((a, b) => a.start - b.start);

  const kept: typeof hits = [];
  let lastEnd = 0;
  for (const hit of hits) {
    if (hit.start >= lastEnd) {
      kept.push(hit);
      lastEnd = hit.end;
    }
  }

  // Right to left, so an earlier insertion never shifts a later index.
  let out = html;
  for (let i = kept.length - 1; i >= 0; i -= 1) {
    const hit = kept[i];
    const open = `<mark data-evidence="1" data-qnum="${hit.n}"${hit.correct ? "" : ' data-ev-wrong="1"'}>`;
    const badge = `<sup data-ev-badge="1">${hit.n}</sup>`;
    out = out.slice(0, hit.start) + open + hit.snippet + badge + "</mark>" + out.slice(hit.end);
  }
  return out;
}

/**
 * Reading passage, in the same sans face and text size as the questions, which
 * is how the computer-delivered exam sets both.
 *
 * In review a student can ask where an answer came from; the snippet is wrapped
 * in a blue mark and scrolled to, which teaches location rather than just
 * revealing the answer.
 *
 * Students can also highlight and annotate it themselves. Their marks are woven
 * into the HTML before parsing, so the passage stays a normal React subtree —
 * see `lib/player/highlights`.
 */
export function PassagePane({
  html,
  title,
  headingSlots,
  evidence,
  evidenceMarks,
  focusQuestion,
  fontSize,
  part,
  highlights = [],
  onAddHighlight,
  onRemoveHighlight,
  onSetNote,
}: {
  html: string;
  /** Passage title, when it is kept out of `html` (see TestPlayer). Rendered as
      a heading above the article, so it never shifts the highlight offsets. */
  title?: string;
  /** Matching-headings: paragraph letter → question number. A numbered drop box
      is woven in above each named paragraph. */
  headingSlots?: Record<string, number>;
  evidence?: Evidence | null;
  /** Review: every answer's location in this passage, badged with its number. */
  evidenceMarks?: EvidenceMark[];
  /** The question whose mark to scroll to as the student steps through review. */
  focusQuestion?: number | null;
  fontSize: number;
  part?: number;
  highlights?: Highlight[];
  onAddHighlight?: (highlight: Highlight) => void;
  onRemoveHighlight?: (id: string) => void;
  onSetNote?: (id: string, note: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const article = useRef<HTMLElement>(null);
  const snippet = evidence?.snippet;
  const showAllMarks = (evidenceMarks?.length ?? 0) > 0;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [openNote, setOpenNote] = useState<OpenNote | null>(null);

  const editable = Boolean(onAddHighlight && part !== undefined);
  const mine = useMemo(
    () => highlights.filter((entry) => entry.part === part),
    [highlights, part],
  );

  const marked = useMemo(() => {
    const withHighlights = mine.length > 0 ? applyHighlightMarks(html, mine) : html;

    // Review: every answer's location at once, each badged with its number.
    if (showAllMarks) return markEvidenceRuns(withHighlights, evidenceMarks!);

    if (!snippet) return withHighlights;

    // The snippet comes verbatim from the source, so a plain first-occurrence
    // replace is enough — and if it has drifted, or a highlight has split the
    // run it sits in, we show the passage unmarked rather than mangling markup.
    const index = withHighlights.indexOf(snippet);
    if (index === -1) return withHighlights;

    return (
      withHighlights.slice(0, index) +
      `<mark data-evidence="1">${snippet}</mark>` +
      withHighlights.slice(index + snippet.length)
    );
  }, [html, mine, snippet, showAllMarks, evidenceMarks]);

  // Matching headings: weave an empty marker in front of each named paragraph,
  // which the parser below swaps for a numbered drop box. Volume passages open a
  // paragraph with a bold letter (`<p><strong>A</strong>`); Cambridge ones tag
  // it `id="para-A"`. The marker carries no text, so it never moves a highlight.
  const parsed = useMemo(() => {
    let source = marked;
    const slots = headingSlots ?? {};
    if (Object.keys(slots).length > 0) {
      source = source.replace(
        /<p>\s*<strong>\s*([A-Za-z])\s*<\/strong>/g,
        (whole, letter: string) =>
          slots[letter.toUpperCase()] != null
            ? `<span data-mh-para="${letter.toUpperCase()}"></span>${whole}`
            : whole,
      );
      source = source.replace(
        /<[a-z][a-z0-9]*[^>]*\sid="para-([A-Za-z0-9]+)"[^>]*>/g,
        (whole, letter: string) =>
          slots[letter.toUpperCase()] != null
            ? `<span data-mh-para="${letter.toUpperCase()}"></span>${whole}`
            : whole,
      );
    }

    const options: HTMLReactParserOptions = {
      replace(node) {
        if (node instanceof DomElement && node.attribs?.["data-mh-para"]) {
          return <HeadingDropSlot paraLetter={node.attribs["data-mh-para"]} />;
        }
        return undefined;
      },
    };
    return parse(source, options);
  }, [marked, headingSlots]);

  // Stepping through review with the navigator brings the current question's
  // mark into view (no flash — it is a quiet move, not a request to look). A
  // "show me where" click also moves here, then the effect below flashes it.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    if (showAllMarks && focusQuestion != null) {
      root
        .querySelector(`[data-qnum="${focusQuestion}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusQuestion, showAllMarks, marked]);

  // "Show me where": jump to that one answer's mark and flash it, so it stands
  // out from the forty other marks already on the passage. Keyed on `evidence`
  // (its nonce changes on every click) so the same target flashes again.
  useEffect(() => {
    const root = scroller.current;
    if (!root || !evidence) return;
    // With a question number (review) go only to that answer's own mark — never
    // fall back to another, which would flash the wrong sentence. Without one
    // (the single-evidence path) use the lone evidence mark or its anchor.
    const target =
      evidence.qnum != null
        ? root.querySelector(`[data-qnum="${evidence.qnum}"]`)
        : (root.querySelector("[data-evidence]") ??
          (evidence.anchor ? root.querySelector(`#${CSS.escape(evidence.anchor)}`) : null));
    if (!(target instanceof HTMLElement)) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("evidence-flash");
    const timer = window.setTimeout(() => target.classList.remove("evidence-flash"), 1200);
    return () => {
      window.clearTimeout(timer);
      target.classList.remove("evidence-flash");
    };
  }, [evidence]);

  /** Character offset of a DOM position within the passage's text. */
  const offsetOf = useCallback((node: Node, offset: number): number => {
    const root = article.current;
    if (!root) return -1;

    // A matching-headings drop box lives inside the passage but is not part of
    // its text: skip it, so its label and any dropped heading never shift the
    // character offsets that highlights are anchored to.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (candidate) =>
        (candidate.parentElement?.closest("[data-mh-slot]"))
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    let total = 0;
    let current = walker.nextNode();

    while (current) {
      if (current === node) return total + offset;
      total += (current as Text).data.length;
      current = walker.nextNode();
    }
    return -1;
  }, []);

  const readSelection = useCallback(() => {
    if (!editable) return;

    const selection = window.getSelection();
    const root = article.current;
    if (!selection || selection.isCollapsed || !root) {
      setDraft(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) {
      setDraft(null);
      return;
    }

    const start = offsetOf(range.startContainer, range.startOffset);
    const end = offsetOf(range.endContainer, range.endOffset);
    const text = selection.toString().trim();

    if (start < 0 || end < 0 || end <= start || !text) {
      setDraft(null);
      return;
    }

    setDraft({ start, end, text, ...anchorIn(scroller.current!, range.getBoundingClientRect()) });
    setOpenNote(null);
  }, [editable, offsetOf]);

  /**
   * Creates the highlight. `andWriteNote` opens the editor on it in the same
   * gesture — asking the student to select, press Note, then hunt for the mark
   * and click it again was three steps for one intention.
   */
  const commit = useCallback(
    (andWriteNote = false) => {
      if (!draft || !onAddHighlight || part === undefined) return;

      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `hl-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      onAddHighlight({
        id,
        part,
        start: draft.start,
        end: draft.end,
        text: draft.text.slice(0, 300),
        note: andWriteNote ? "" : undefined,
      });

      window.getSelection()?.removeAllRanges();
      if (andWriteNote) setOpenNote({ id, x: draft.x - 140, y: draft.y + 22 });
      setDraft(null);
    },
    [draft, onAddHighlight, part],
  );

  /** Clicking an existing mark opens its note rather than starting a new one. */
  const onArticleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!editable) return;
      const mark = (event.target as HTMLElement).closest?.("mark[data-hl]");
      if (!mark) return;

      const id = mark.getAttribute("data-hl");
      if (!id) return;

      const anchor = anchorIn(scroller.current!, mark.getBoundingClientRect());
      setOpenNote({ id, x: anchor.left, y: anchor.bottom });
      setDraft(null);
    },
    [editable],
  );

  const active = openNote ? mine.find((entry) => entry.id === openNote.id) : undefined;

  return (
    <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:px-8">
      {title && (
        <h1 className="mb-4 font-sans text-xl font-bold text-ink">{title}</h1>
      )}
      <article
        ref={article}
        style={{ fontSize }}
        onMouseUp={readSelection}
        onClick={onArticleClick}
        className="leading-[1.75] text-ink [&_.para-label]:font-bold [&_[data-ev-badge]]:ml-0.5 [&_[data-ev-badge]]:rounded [&_[data-ev-badge]]:bg-brand-blue [&_[data-ev-badge]]:px-1 [&_[data-ev-badge]]:py-px [&_[data-ev-badge]]:align-super [&_[data-ev-badge]]:font-sans [&_[data-ev-badge]]:text-[9px] [&_[data-ev-badge]]:font-bold [&_[data-ev-badge]]:leading-none [&_[data-ev-badge]]:text-white [&_[data-ev-wrong]]:bg-brand-red-cta/[0.12] [&_[data-ev-wrong]]:shadow-[inset_0_-2px_0_#e10046] [&_[data-ev-wrong]_[data-ev-badge]]:bg-brand-red-cta [&_[data-evidence]]:rounded [&_[data-evidence]]:bg-brand-blue/15 [&_[data-evidence]]:px-0.5 [&_[data-evidence]]:text-ink [&_[data-evidence]]:shadow-[inset_0_-2px_0_#0154f8] [&_[data-hl]]:cursor-pointer [&_[data-hl]]:rounded-sm [&_[data-hl]]:bg-[#ffe89a] [&_[data-hl]]:text-ink [&_[data-note]]:shadow-[inset_0_-2px_0_#e10046] [&_h1]:mb-4 [&_h1]:font-sans [&_h1]:text-xl [&_h1]:font-bold [&_h4]:mb-3 [&_h4]:font-sans [&_h4]:font-bold [&_h5]:mb-2 [&_h5]:mt-5 [&_h5]:font-sans [&_h5]:font-bold [&_p]:mb-4"
      >
        {parsed}
      </article>

      {draft && (
        <SelectionToolbar
          x={draft.x}
          y={draft.y}
          onHighlight={() => commit(false)}
          onNote={() => commit(true)}
          onDismiss={() => {
            window.getSelection()?.removeAllRanges();
            setDraft(null);
          }}
        />
      )}

      {active && openNote && (
        <NotePopover
          x={openNote.x}
          y={openNote.y}
          highlight={active}
          onSave={(note) => {
            onSetNote?.(active.id, note);
            setOpenNote(null);
          }}
          onRemove={() => {
            onRemoveHighlight?.(active.id);
            setOpenNote(null);
          }}
          onClose={() => setOpenNote(null)}
        />
      )}
    </div>
  );
}

function SelectionToolbar({
  x,
  y,
  onHighlight,
  onNote,
  onDismiss,
}: {
  x: number;
  y: number;
  onHighlight: () => void;
  onNote: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      // Sits above the selection, nudged left by half its own width.
      style={{ left: x, top: Math.max(0, y - 46) }}
      className="absolute z-20 -translate-x-1/2 rounded-[9px] bg-ink p-1 shadow-lg"
      // mousedown, not click: the browser clears the selection on mousedown
      // elsewhere, which would empty the draft before the handler ran.
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="flex items-center gap-0.5">
        <ToolbarButton onClick={onHighlight} label="Highlight">
          <span className="h-3 w-3 rounded-sm bg-[#ffe89a]" aria-hidden />
          Highlight
        </ToolbarButton>
        <ToolbarButton onClick={onNote} label="Add a note">
          <NoteIcon />
          Note
        </ToolbarButton>
        <ToolbarButton onClick={onDismiss} label="Cancel">
          ✕
        </ToolbarButton>
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 font-sans text-[12px] font-bold text-white transition hover:bg-white/15"
    >
      {children}
    </button>
  );
}

function NotePopover({
  x,
  y,
  highlight,
  onSave,
  onRemove,
  onClose,
}: {
  x: number;
  y: number;
  highlight: Highlight;
  onSave: (note: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(highlight.note ?? "");
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    area.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={{ left: Math.max(8, x), top: y + 8 }}
      className="absolute z-20 w-[280px] rounded-xl bg-white p-3 font-sans shadow-[0_18px_40px_-12px_rgba(11,17,32,.45)] ring-1 ring-ink/10"
    >
      <p className="line-clamp-2 text-[11.5px] italic leading-snug text-ink-subtle">
        “{highlight.text}”
      </p>

      <textarea
        ref={area}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={3}
        placeholder="Note to yourself…"
        className="mt-2 w-full resize-none rounded-[9px] bg-surface-alt px-2.5 py-2 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:shadow-[inset_0_0_0_2px_#0154f8]"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSave(value)}
          className="flex-1 rounded-[9px] bg-ink px-3 py-2 text-[12px] font-bold text-white transition hover:bg-ink/85"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            "rounded-[9px] bg-surface-alt px-3 py-2 text-[12px] font-bold text-ink-muted transition",
            "hover:bg-brand-red-cta hover:text-white",
          )}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function NoteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h16v12H8l-4 4z" />
    </svg>
  );
}
