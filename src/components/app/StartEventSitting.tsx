"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { enterFullscreen } from "./MockProgress";

/**
 * Starts an event sitting, or opens its next section.
 *
 * Two calls, same as a normal mock: one to enrol and create the sitting (which
 * simply returns it if it already exists), one to open the next section and
 * start its clock. Both land in the section's player.
 */
export function StartEventSitting({
  eventId,
  mode,
}: {
  eventId: string;
  mode: "start" | "continue";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    // Asked for inside the click, before anything async, or the browser
    // refuses it as unprompted.
    enterFullscreen();
    setBusy(true);
    setError(null);
    try {
      const joined = await fetch(`/api/events/${eventId}/start`, { method: "POST" });
      const data = await joined.json();
      if (!joined.ok) {
        setError(data?.error ?? "Could not start the mock test.");
        return;
      }

      const opened = await fetch(`/api/full-mocks/${data.fullMockId}/start`, { method: "POST" });
      const next = await opened.json();
      if (!opened.ok) {
        setError(next?.error ?? "Could not open the next section.");
        return;
      }

      router.push(`/attempt/${next.attemptId}`);
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-[10px] bg-brand-red-cta px-6 py-4 text-base font-bold text-white shadow-[0_16px_30px_-12px_rgba(225,0,70,.65)] transition hover:bg-brand-red-dark disabled:opacity-60"
      >
        {busy ? "Opening…" : mode === "start" ? "Start the mock test" : "Continue"}
        <span aria-hidden>→</span>
      </button>
      {mode === "start" && (
        <p className="mt-2.5 text-center text-xs text-ink-subtle">
          The listening clock starts as soon as you press this.
        </p>
      )}
      {error && <p className="mt-3 text-sm font-semibold text-bad">{error}</p>}
    </div>
  );
}
