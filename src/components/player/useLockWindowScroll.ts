"use client";

import { useEffect } from "react";

/**
 * A player owns the whole viewport and is meant to scroll only inside its own
 * panes. In review the marked paper can leave the document itself a little
 * taller than the viewport, and a `scrollIntoView` on a passage mark then drags
 * the *window* down — sliding the `h-dvh` player up and exposing the bare page
 * beneath the navigator as a grey gap.
 *
 * Locking the document's own scroll while a player is mounted keeps every scroll
 * where it belongs: inside the panes. Restored on unmount, so the marketing and
 * dashboard pages scroll normally again.
 */
export function useLockWindowScroll() {
  useEffect(() => {
    // Lock both the root and the body: on the player pages the body is the
    // element that actually scrolls, so locking only the root would leave the
    // window free to move — which is exactly the bug this guards against.
    const html = document.documentElement;
    const { body } = document;
    const previous = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous.html;
      body.style.overflow = previous.body;
    };
  }, []);
}
