"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Seconds left, measured against the server's deadline rather than counted down
 * locally, so a backgrounded tab cannot drift. Only the clock is state; the
 * remaining time is derived during render.
 *
 * `frozen` stops the ticking once an attempt is over — a submitted test must
 * not keep firing the expiry callback.
 */
export function useCountdown(
  expiresAt: string | null,
  frozen: boolean,
  onExpire: () => void,
): number | null {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);

  useEffect(() => {
    if (!expiresAt || frozen) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt, frozen]);

  const remaining = expiresAt
    ? Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000))
    : null;

  useEffect(() => {
    if (remaining === 0 && !fired.current) {
      fired.current = true;
      onExpire();
    }
  }, [remaining, onExpire]);

  return remaining;
}
