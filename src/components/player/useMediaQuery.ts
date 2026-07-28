"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Breakpoint state from matchMedia rather than a resize listener: it fires
 * exactly on the crossing, cannot be throttled away, and needs no effect to
 * seed its initial value.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  // The server renders the wide layout; the client corrects on hydration.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
