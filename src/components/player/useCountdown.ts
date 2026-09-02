"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Seconds left until `expiresAt`, ticking once a second, calling `onExpire`
 * once when it reaches zero. Returns null when there is no deadline, which is
 * every practice attempt.
 *
 * The deadline is set by the server, so it can only be read against the
 * server's clock. Measuring it against the device clock instead makes the
 * timer wrong by exactly the device's error: a student whose laptop was ten
 * hours behind was shown 657 minutes on a sixty-minute paper. `serverNow` is
 * the server's own time at render, and the offset between the two clocks is
 * captured once and applied to every tick after it. Without it the hook falls
 * back to the device clock, which is the old behaviour.
 *
 * This is display only. The deadline the submission is actually judged against
 * lives on the server, so a wrong device clock has never granted extra time.
 */
export function useCountdown(
  expiresAt: string | null,
  frozen: boolean,
  onExpire: () => void,
  serverNow?: string,
): number | null {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);

  // How far this device's clock sits from the server's, measured once on the
  // first render so a later one cannot shift the reading mid-countdown.
  const [skew] = useState(() => {
    const server = serverNow ? new Date(serverNow).getTime() : NaN;
    return Number.isFinite(server) ? Date.now() - server : 0;
  });

  useEffect(() => {
    if (!expiresAt || frozen) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt, frozen]);

  const remaining = expiresAt
    ? Math.max(0, Math.round((new Date(expiresAt).getTime() - (now - skew)) / 1000))
    : null;

  useEffect(() => {
    if (remaining === 0 && !fired.current) {
      fired.current = true;
      onExpire();
    }
  }, [remaining, onExpire]);

  return remaining;
}
