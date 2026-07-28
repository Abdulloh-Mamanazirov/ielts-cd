"use client";

import parse, { type HTMLReactParserOptions } from "html-react-parser";
import { Element } from "domhandler";
import { useMemo, type ReactNode } from "react";

import { SLOT_PATTERN } from "@/lib/tests/schema";

/**
 * Renders question HTML with `{{n}}` markers replaced by real inputs.
 *
 * The markers are first rewritten to `<span data-slot="n"></span>`. Splitting
 * the HTML string on the markers directly would tear tags in half — a slot
 * inside a table cell would leave `<td>Provides ` as its own fragment — whereas
 * a span is valid anywhere text is, so the markup stays well-formed and the
 * parser can swap the span for a component.
 */
export function SlotHtml({
  html,
  renderSlot,
}: {
  html: string;
  renderSlot: (questionNumber: number) => ReactNode;
}) {
  return useMemo(() => {
    const withPlaceholders = html.replace(
      SLOT_PATTERN,
      (_match, number: string) => `<span data-slot="${number}"></span>`,
    );

    const options: HTMLReactParserOptions = {
      replace(node) {
        if (!(node instanceof Element)) return undefined;

        const slot = node.attribs?.["data-slot"];
        if (slot && /^\d+$/.test(slot)) {
          return <>{renderSlot(Number(slot))}</>;
        }

        return undefined;
      },
    };

    return <>{parse(withPlaceholders, options)}</>;
  }, [html, renderSlot]);
}

/** Same parsing without slots, for passages and rubrics. */
export function RichHtml({ html, className }: { html: string; className?: string }) {
  const content = useMemo(() => parse(html), [html]);
  return <div className={className}>{content}</div>;
}
