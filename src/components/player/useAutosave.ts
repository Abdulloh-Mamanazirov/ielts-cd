"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "expired";

type Payload = {
  answers?: Record<string, string>;
  flags?: number[];
  annotations?: unknown;
};

/**
 * Debounced autosave. Coalesces rapid typing into one request and always
 * flushes the latest state, so a student who keeps typing until the timer ends
 * still has their last keystrokes stored.
 */
export function useAutosave(attemptId: string, delayMs = 1200) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const pending = useRef<Payload>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  const flush = useCallback(async () => {
    if (inFlight.current) return;
    const payload = pending.current;
    if (Object.keys(payload).length === 0) return;

    pending.current = {};
    inFlight.current = true;
    setStatus("saving");

    try {
      const response = await fetch(`/api/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 409) {
        const data = await response.json().catch(() => ({}));
        setStatus(data?.expired ? "expired" : "error");
        return;
      }
      setStatus(response.ok ? "saved" : "error");
    } catch {
      // Put the work back so a dropped connection does not lose answers.
      pending.current = { ...payload, ...pending.current };
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }, [attemptId]);

  const queue = useCallback(
    (payload: Payload) => {
      pending.current = {
        ...pending.current,
        ...payload,
        answers: { ...pending.current.answers, ...payload.answers },
      };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delayMs);
    },
    [flush, delayMs],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { queue, flush, status };
}
