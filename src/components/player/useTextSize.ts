"use client";

import { useCallback, useSyncExternalStore } from "react";

/** The design's three steps. Anything else and passages reflow unpredictably. */
export const TEXT_STEPS = [16, 18, 20] as const;
type TextStep = (typeof TEXT_STEPS)[number];

const STORAGE_KEY = "ielts:textSize";

/**
 * Reading size persists per student, so it survives between tests.
 *
 * Backed by useSyncExternalStore rather than an effect: localStorage is a store
 * outside React, and this gives a stable server snapshot for hydration without
 * setting state during render or in an effect.
 */
const listeners = new Set<() => void>();
let cached: TextStep | null = null;

function isStep(value: number): value is TextStep {
  return (TEXT_STEPS as readonly number[]).includes(value);
}

function getSnapshot(): TextStep {
  if (cached !== null) return cached;
  const stored = Number(window.localStorage.getItem(STORAGE_KEY));
  cached = isStep(stored) ? stored : TEXT_STEPS[0];
  return cached;
}

function getServerSnapshot(): TextStep {
  return TEXT_STEPS[0];
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(value: TextStep) {
  cached = value;
  window.localStorage.setItem(STORAGE_KEY, String(value));
  for (const listener of listeners) listener();
}

export function useTextSize() {
  const size = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const step = useCallback((direction: 1 | -1) => {
    const index = TEXT_STEPS.indexOf(getSnapshot());
    const next = TEXT_STEPS[Math.min(TEXT_STEPS.length - 1, Math.max(0, index + direction))];
    write(next);
  }, []);

  return {
    size,
    step,
    canDecrease: size > TEXT_STEPS[0],
    canIncrease: size < TEXT_STEPS[TEXT_STEPS.length - 1],
  };
}
