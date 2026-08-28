"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { QuestionHighlight } from "@/lib/player/highlights";

/** One registered highlight set; the name is styled in globals.css. */
const HL_NAME = "question-mark";

type SupportedCSS = typeof CSS & { highlights: Map<string, unknown> };

function highlightsSupported(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
}

/** Char offset of a DOM position within `root`'s text (inputs contribute none). */
function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) return total + offset;
    total += (current as Text).data.length;
    current = walker.nextNode();
  }
  return -1;
}

/** Builds a DOM Range spanning [start, end) over `root`'s text nodes. */
function rangeFromOffsets(root: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let total = 0;
  let startSet = false;
  let node = walker.nextNode() as Text | null;

  while (node) {
    const len = node.data.length;
    if (!startSet && total + len > start) {
      range.setStart(node, Math.max(0, start - total));
      startSet = true;
    }
    if (startSet && total + len >= end) {
      range.setEnd(node, Math.min(len, end - total));
      return range;
    }
    total += len;
    node = walker.nextNode() as Text | null;
  }
  return null;
}

type Draft = { start: number; end: number; text: string; x: number; y: number; overlaps: boolean };

/**
 * Lets a student highlight words in the questions column, the way they can in a
 * reading passage. Listening has no passage to mark, so this is the equivalent
 * study aid over the questions themselves.
 *
 * Marks are painted with the CSS Custom Highlight API, so the interactive
 * question DOM (inputs, option buttons, drag tiles) is never mutated and React
 * never fights the marks. Ranges are rebuilt from stored text offsets whenever
 * the pane re-renders. Only active while solving: in review the pane grows extra
 * text (verdicts, answers) that would shift the offsets.
 */
export function QuestionHighlighter({
  part,
  fontSize,
  enabled,
  highlights,
  onAdd,
  onRemove,
  className,
  children,
}: {
  part: number;
  fontSize: number;
  enabled: boolean;
  highlights: QuestionHighlight[];
  onAdd: (highlight: QuestionHighlight) => void;
  onRemove: (id: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const mine = highlights.filter((entry) => entry.part === part);

  const apply = useCallback(() => {
    if (!highlightsSupported()) return;
    const root = ref.current;
    const store = (CSS as SupportedCSS).highlights;
    if (!root || !enabled) {
      store.delete(HL_NAME);
      return;
    }
    const ranges = highlights
      .filter((entry) => entry.part === part)
      .map((entry) => rangeFromOffsets(root, entry.start, entry.end))
      .filter((range): range is Range => range !== null);

    if (ranges.length === 0) store.delete(HL_NAME);
    else store.set(HL_NAME, new Highlight(...ranges));
  }, [highlights, part, enabled]);

  // Repaint on mount and whenever the marks/part change, and again after any
  // re-render of the pane (answering a question re-renders it and can replace
  // the text nodes the ranges pointed at).
  useEffect(() => {
    apply();
    const root = ref.current;
    if (!root || !highlightsSupported()) return;
    let raf = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      (CSS as SupportedCSS).highlights?.delete(HL_NAME);
    };
  }, [apply]);

  const readSelection = useCallback(() => {
    if (!enabled) return;
    const selection = window.getSelection();
    const root = ref.current;
    if (!selection || selection.isCollapsed || !root) {
      setDraft(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) {
      setDraft(null);
      return;
    }
    const start = offsetOf(root, range.startContainer, range.startOffset);
    const end = offsetOf(root, range.endContainer, range.endOffset);
    const text = selection.toString().trim();
    if (start < 0 || end < 0 || end <= start || !text) {
      setDraft(null);
      return;
    }
    const box = range.getBoundingClientRect();
    const bounds = root.getBoundingClientRect();
    setDraft({
      start,
      end,
      text,
      x: box.left - bounds.left + root.scrollLeft + box.width / 2,
      y: box.top - bounds.top + root.scrollTop,
      overlaps: mine.some((entry) => entry.start < end && entry.end > start),
    });
  }, [enabled, mine]);

  const commit = useCallback(() => {
    if (!draft) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `qh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    onAdd({ id, part, start: draft.start, end: draft.end, text: draft.text.slice(0, 300) });
    window.getSelection()?.removeAllRanges();
    setDraft(null);
  }, [draft, onAdd, part]);

  const clearOverlapping = useCallback(() => {
    if (!draft) return;
    mine
      .filter((entry) => entry.start < draft.end && entry.end > draft.start)
      .forEach((entry) => onRemove(entry.id));
    window.getSelection()?.removeAllRanges();
    setDraft(null);
  }, [draft, mine, onRemove]);

  // A plain click on a mark clears it — the light-touch way to undo one.
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      if (!enabled) return;
      const target = event.target as HTMLElement;
      if (target.closest('input,textarea,select,button,label,a,[role="button"],[draggable="true"]')) {
        return;
      }
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      const root = ref.current;
      if (!root) return;
      // caretRangeFromPoint is Blink/WebKit; Firefox exposes caretPositionFromPoint.
      let node: Node | null = null;
      let nodeOffset = 0;
      const caretRange = document.caretRangeFromPoint?.(event.clientX, event.clientY);
      if (caretRange) {
        node = caretRange.startContainer;
        nodeOffset = caretRange.startOffset;
      } else {
        const pos = (
          document as Document & {
            caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
          }
        ).caretPositionFromPoint?.(event.clientX, event.clientY);
        if (pos) {
          node = pos.offsetNode;
          nodeOffset = pos.offset;
        }
      }
      if (!node || !root.contains(node)) return;
      const at = offsetOf(root, node, nodeOffset);
      const hit = mine.find((entry) => at >= entry.start && at < entry.end);
      if (hit) onRemove(hit.id);
    },
    [enabled, mine, onRemove],
  );

  return (
    <div
      ref={ref}
      onMouseUp={enabled ? readSelection : undefined}
      onClick={enabled ? onClick : undefined}
      className={className}
      style={{ fontSize }}
    >
      {children}

      {draft && (
        <div
          style={{ left: draft.x, top: Math.max(0, draft.y - 46) }}
          className="absolute z-20 -translate-x-1/2 rounded-[9px] bg-ink p-1 shadow-lg"
          onMouseDown={(event) => event.preventDefault()}
        >
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={commit}
              className="inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 font-sans text-[12px] font-bold text-white transition hover:bg-white/15"
            >
              <span className="h-3 w-3 rounded-sm bg-[#ffe89a]" aria-hidden />
              Highlight
            </button>
            {draft.overlaps && (
              <button
                type="button"
                onClick={clearOverlapping}
                className="inline-flex items-center rounded-[7px] px-2.5 py-1.5 font-sans text-[12px] font-bold text-white transition hover:bg-white/15"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                window.getSelection()?.removeAllRanges();
                setDraft(null);
              }}
              className="inline-flex items-center rounded-[7px] px-2.5 py-1.5 font-sans text-[12px] font-bold text-white transition hover:bg-white/15"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
