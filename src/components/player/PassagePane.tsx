"use client";

import { useEffect, useMemo, useRef } from "react";

import { RichHtml } from "./SlotHtml";

export type Evidence = { anchor?: string; snippet?: string };

/**
 * Reading passage, set in serif because exam prose is read at length.
 *
 * In review a student can ask where an answer came from; the snippet is wrapped
 * in a blue mark and scrolled to, which teaches location rather than just
 * revealing the answer.
 */
export function PassagePane({
  html,
  instructionsHtml,
  evidence,
  fontSize,
}: {
  html: string;
  instructionsHtml?: string;
  evidence?: Evidence | null;
  fontSize: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const snippet = evidence?.snippet;

  const marked = useMemo(() => {
    if (!snippet) return html;

    // The snippet comes verbatim from the source, so a plain first-occurrence
    // replace is enough — and if it has drifted we simply show the passage
    // unmarked rather than mangling the markup.
    const index = html.indexOf(snippet);
    if (index === -1) return html;

    return (
      html.slice(0, index) +
      `<mark data-evidence="1">${snippet}</mark>` +
      html.slice(index + snippet.length)
    );
  }, [html, snippet]);

  useEffect(() => {
    if (!evidence) return;
    const root = scroller.current;
    if (!root) return;

    const target =
      root.querySelector("[data-evidence]") ??
      (evidence.anchor ? root.querySelector(`#${CSS.escape(evidence.anchor)}`) : null);

    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [evidence, marked]);

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:px-8">
      {instructionsHtml && (
        <RichHtml
          html={instructionsHtml}
          className="mb-5 border-l-2 border-brand-red pl-4 text-sm text-ink-muted [&_h3]:font-display [&_h3]:text-base [&_h3]:text-ink"
        />
      )}

      <article
        style={{ fontSize }}
        className="font-serif leading-[1.75] text-ink [&_.para-label]:font-bold [&_[data-evidence]]:rounded [&_[data-evidence]]:bg-brand-blue/15 [&_[data-evidence]]:px-0.5 [&_[data-evidence]]:text-ink [&_[data-evidence]]:shadow-[inset_0_-2px_0_#0154f8] [&_h1]:mb-4 [&_h1]:font-sans [&_h1]:text-xl [&_h1]:font-bold [&_h4]:mb-3 [&_h4]:font-sans [&_h4]:font-bold [&_h5]:mb-2 [&_h5]:mt-5 [&_h5]:font-sans [&_h5]:font-bold [&_p]:mb-4"
      >
        <RichHtml html={marked} />
      </article>
    </div>
  );
}
