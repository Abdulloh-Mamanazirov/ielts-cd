"use client";

import { useState, useTransition } from "react";

import { updateMockSettings } from "@/app/admin/actions";
import type { MockSettings } from "@/lib/mock-settings";
import { cn } from "@/lib/utils";

/** The switch for the end-of-mock celebration. Saved as flipped. */
export function MockSettingsEditor({ initial }: { initial: MockSettings }) {
  const [settings, setSettings] = useState<MockSettings>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = () => {
    const previous = settings;
    const next = { celebrateCompletion: !settings.celebrateCompletion };
    setSettings(next);
    setMessage(null);
    setError(null);
    start(async () => {
      const result = await updateMockSettings(next);
      if (result.ok) setMessage(result.message);
      else {
        setSettings(previous);
        setError(result.error);
      }
    });
  };

  const on = settings.celebrateCompletion;

  return (
    <section className="rounded-xl bg-white p-6 shadow-[0_1px_2px_rgba(11,17,32,.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[62ch]">
          <h2 className="text-sm font-bold text-ink">Celebrate a finished mock</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
            When a student submits the last section of any full mock — including a mock test
            event — confetti falls and a congratulations card shows their result. Off, the results
            simply appear.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Celebrate a finished mock"
          disabled={pending}
          onClick={toggle}
          className={cn(
            "relative h-7 w-12 flex-none rounded-full transition disabled:opacity-60",
            on ? "bg-ok" : "bg-ink/20",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
              on ? "left-6" : "left-1",
            )}
          />
        </button>
      </div>
      {message && <p className="mt-3 text-[13px] font-bold text-ok">{message}</p>}
      {error && <p className="mt-3 text-[13px] font-bold text-bad">{error}</p>}
    </section>
  );
}
