"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "ielts:volume";
const DEFAULT_VOLUME = 0.8;

/**
 * Playback volume persists per student, the same way reading size does — a
 * student who turned it down for one test should not have to do it again for
 * the next. Same useSyncExternalStore shape as useTextSize.
 */
const listeners = new Set<() => void>();
let cached: number | null = null;

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function getSnapshot(): number {
  if (cached !== null) return cached;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  // Not `Number(raw)` alone: a missing key reads as 0, which is a legitimate
  // volume, and every new student would start muted.
  const stored = raw === null ? Number.NaN : Number(raw);
  cached = Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : DEFAULT_VOLUME;
  return cached;
}

function getServerSnapshot(): number {
  return DEFAULT_VOLUME;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useVolume() {
  const volume = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setVolume = useCallback((next: number) => {
    cached = clamp(next);
    window.localStorage.setItem(STORAGE_KEY, String(cached));
    for (const listener of listeners) listener();
  }, []);

  return { volume, setVolume };
}
