"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Starts a mock, or opens its next section.
 *
 * Both actions end in the same place — a section's player — so they share a
 * component rather than duplicating the two-step fetch.
 */
export function StartFullMock({
  mode,
  fullMockId,
}: {
  mode: "start" | "continue";
  fullMockId?: string;
}) {
  const router = useRouter();
  const [includeSpeaking, setIncludeSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);

    try {
      let id = fullMockId;

      if (mode === "start") {
        const created = await fetch("/api/full-mocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ includeSpeaking }),
        });
        const data = await created.json();
        if (!created.ok) {
          setError(data?.error ?? "Could not start a full mock.");
          return;
        }
        id = data.fullMock.id;
      }

      const started = await fetch(`/api/full-mocks/${id}/start`, { method: "POST" });
      const data = await started.json();
      if (!started.ok) {
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

  const abandon = async () => {
    if (!fullMockId) return;
    if (!window.confirm("Give up on this mock? Sections you have already submitted are kept.")) {
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/full-mocks/${fullMockId}/abandon`, { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data?.error ?? "Could not abandon this mock.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5">
      {mode === "start" && (
        <label className="mb-4 flex w-fit cursor-pointer items-center gap-2.5 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={includeSpeaking}
            onChange={(event) => setIncludeSpeaking(event.target.checked)}
            className="h-4 w-4 accent-brand-blue"
          />
          Include speaking (adds about 15 minutes and needs a microphone)
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={go}
          disabled={busy}
          className="rounded-[10px] bg-brand-red-cta px-6 py-3.5 text-sm font-bold text-white shadow-[0_14px_26px_-12px_rgba(225,0,70,.7)] transition hover:bg-brand-red-dark disabled:opacity-60"
        >
          {busy
            ? "Opening…"
            : mode === "start"
              ? "Start full mock"
              : "Continue to the next section"}
        </button>

        {/* Only one mock runs at a time, so without a way out an abandoned
            sitting would block every future one. */}
        {mode === "continue" && (
          <button
            type="button"
            onClick={abandon}
            disabled={busy}
            className="rounded-[10px] bg-surface-alt px-4 py-3.5 text-[13px] font-bold text-ink-muted transition hover:bg-ink hover:text-white disabled:opacity-60"
          >
            Give up on this mock
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-brand-red-cta">
          {error}
        </p>
      )}
    </div>
  );
}
