"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "./useMediaQuery";

const MIN_PERCENT = 32;
const MAX_PERCENT = 68;
const NARROW_BREAKPOINT = 900;

/**
 * Two panes with a draggable divider on wide screens. Below 900px it becomes
 * two tabs rather than two columns — a 45% column of exam prose is unreadable,
 * and shrinking both is worse than showing one at a time.
 */
export function SplitView({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  leftLabel: string;
  rightLabel: string;
}) {
  const [percent, setPercent] = useState(54);
  const narrow = useMediaQuery(`(max-width: ${NARROW_BREAKPOINT - 1}px)`);
  const [tab, setTab] = useState<"left" | "right">("left");
  const [dragging, setDragging] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const moveTo = useCallback((clientX: number) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const raw = ((clientX - box.left) / box.width) * 100;
    setPercent(Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, raw)));
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => moveTo(event.clientX);
    const onUp = () => setDragging(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // Stops the passage text from being selected while dragging.
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
    };
  }, [dragging, moveTo]);

  if (narrow) {
    return (
      <div className="flex min-h-0 flex-1 flex-col p-2.5">
        <div role="tablist" aria-label="Test panes" className="flex flex-none gap-1 pb-2.5">
          {(["left", "right"] as const).map((key) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 rounded-[9px] px-4 py-2.5 text-sm font-bold transition",
                tab === key ? "bg-ink text-white" : "bg-white text-ink-muted",
              )}
            >
              {key === "left" ? leftLabel : rightLabel}
            </button>
          ))}
        </div>
        {/* flex-col, not a bare block: the pane inside sizes itself with
            `flex-1`, which only works if its parent is a flex container. As a
            block this wrapper let the pane grow to its full content height, so
            it overflowed instead of scrolling — the scroll only moved when a
            nav tap called scrollIntoView, never by touch. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(11,17,32,.08)]">
          {tab === "left" ? left : right}
        </div>
      </div>
    );
  }

  return (
    <div ref={wrap} className="flex min-h-0 flex-1 p-3.5">
      <div
        style={{ flex: `0 0 ${percent}%` }}
        className="flex min-w-0 flex-col overflow-hidden rounded-l-xl bg-white shadow-[0_1px_2px_rgba(11,17,32,.08)]"
      >
        {left}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={MIN_PERCENT}
        aria-valuemax={MAX_PERCENT}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setPercent((p) => Math.max(MIN_PERCENT, p - 2));
          if (event.key === "ArrowRight") setPercent((p) => Math.min(MAX_PERCENT, p + 2));
        }}
        className={cn(
          "group relative w-2.5 flex-none cursor-col-resize bg-surface-alt",
          "focus-visible:outline-2 focus-visible:outline-brand-blue",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-1/2 top-1/2 h-9 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition",
            dragging ? "bg-brand-blue" : "bg-ink/20 group-hover:bg-ink/40",
          )}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-r-xl bg-white shadow-[0_1px_2px_rgba(11,17,32,.08)]">
        {right}
      </div>
    </div>
  );
}
