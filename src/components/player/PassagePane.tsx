"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { applyHighlightMarks, type Highlight } from "@/lib/player/highlights";
import { cn } from "@/lib/utils";
import { RichHtml } from "./SlotHtml";

export type Evidence = { anchor?: string; snippet?: string };

type Draft = { start: number; end: number; text: string; x: number; y: number };
type OpenNote = { id: string; x: number; y: number };

/**
 * Reading passage, set in serif because exam prose is read at length.
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
  instructionsHtml,
  evidence,
  fontSize,
  part,
  highlights = [],
  onAddHighlight,
  onRemoveHighlight,
  onSetNote,
}: {
  html: string;
  instructionsHtml?: string;
  evidence?: Evidence | null;
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

  const [draft, setDraft] = useState<Draft | null>(null);
  const [openNote, setOpenNote] = useState<OpenNote | null>(null);

  const editable = Boolean(onAddHighlight && part !== undefined);
  const mine = useMemo(
    () => highlights.filter((entry) => entry.part === part),
    [highlights, part],
  );

  const marked = useMemo(() => {
    const withHighlights = mine.length > 0 ? applyHighlightMarks(html, mine) : html;
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
  }, [html, mine, snippet]);

  useEffect(() => {
    if (!evidence) return;
    const root = scroller.current;
    if (!root) return;

    const target =
      root.querySelector("[data-evidence]") ??
      (evidence.anchor ? root.querySelector(`#${CSS.escape(evidence.anchor)}`) : null);

    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [evidence, marked]);

  /** Character offset of a DOM position within the passage's text. */
  const offsetOf = useCallback((node: Node, offset: number): number => {
    const root = article.current;
    if (!root) return -1;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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

    const box = range.getBoundingClientRect();
    const bounds = scroller.current!.getBoundingClientRect();
    setDraft({
      start,
      end,
      text,
      x: box.left - bounds.left + box.width / 2,
      y: box.top - bounds.top,
    });
    setOpenNote(null);
  }, [editable, offsetOf]);

  const commit = useCallback(
    (note?: string) => {
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
        note,
      });

      window.getSelection()?.removeAllRanges();
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

      const box = mark.getBoundingClientRect();
      const bounds = scroller.current!.getBoundingClientRect();
      setOpenNote({ id, x: box.left - bounds.left, y: box.bottom - bounds.top });
      setDraft(null);
    },
    [editable],
  );

  const active = openNote ? mine.find((entry) => entry.id === openNote.id) : undefined;

  return (
    <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:px-8">
      {instructionsHtml && (
        <RichHtml
          html={instructionsHtml}
          className="mb-5 border-l-2 border-brand-red pl-4 text-sm text-ink-muted [&_h3]:font-display [&_h3]:text-base [&_h3]:text-ink"
        />
      )}

      <article
        ref={article}
        style={{ fontSize }}
        onMouseUp={readSelection}
        onClick={onArticleClick}
        className="font-serif leading-[1.75] text-ink [&_.para-label]:font-bold [&_[data-evidence]]:rounded [&_[data-evidence]]:bg-brand-blue/15 [&_[data-evidence]]:px-0.5 [&_[data-evidence]]:text-ink [&_[data-evidence]]:shadow-[inset_0_-2px_0_#0154f8] [&_[data-hl]]:cursor-pointer [&_[data-hl]]:rounded-sm [&_[data-hl]]:bg-[#ffe89a] [&_[data-hl]]:text-ink [&_[data-note]]:shadow-[inset_0_-2px_0_#e10046] [&_h1]:mb-4 [&_h1]:font-sans [&_h1]:text-xl [&_h1]:font-bold [&_h4]:mb-3 [&_h4]:font-sans [&_h4]:font-bold [&_h5]:mb-2 [&_h5]:mt-5 [&_h5]:font-sans [&_h5]:font-bold [&_p]:mb-4"
      >
        <RichHtml html={marked} />
      </article>

      {draft && (
        <SelectionToolbar
          x={draft.x}
          y={draft.y}
          onHighlight={() => commit()}
          onNote={() => commit("")}
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
