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
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);
}
