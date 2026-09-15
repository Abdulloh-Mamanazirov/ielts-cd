"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The one button between sections of a mock: opens the next one, in full
 * screen, so a student mid-exam is not looking at a browser with tabs.
 *
 * Full screen has to be asked for inside the click, before anything async,
 * or the browser refuses it as unprompted.
 */
export function ContinueMock({ fullMockId, label }: { fullMockId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    enterFullscreen();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/full-mocks/${fullMockId}/start`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "Could not open the next section.");
        return;
      }
      router.push(`/attempt/${data.attemptId}`);
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
        {busy ? "Opening…" : label}
        <span aria-hidden>→</span>
      </button>
      {error && <p className="mt-3 text-center text-sm font-semibold text-bad">{error}</p>}
    </div>
  );
}

/** Best effort: a browser that refuses (or a phone that cannot) just carries on. */
export function enterFullscreen() {
  try {
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) {
      void root.requestFullscreen().catch(() => {});
    }
  } catch {
    // Not available; nothing to do.
  }
}

export function exitFullscreen() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      void document.exitFullscreen().catch(() => {});
    }
  } catch {
    // Not available; nothing to do.
  }
}
