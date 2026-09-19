"use client";

import { useState, useTransition } from "react";

import { updateMockSettings } from "@/app/admin/actions";
import type { MockSettings } from "@/lib/mock-settings";
import { cn } from "@/lib/utils";

const SWITCHES: Array<{
  key: keyof MockSettings;
  label: string;
  on: string;
  off: string;
}> = [
  {
    key: "showSectionBands",
    label: "Show band scores after a mock",
    on: "Students see each section's band and score, and the overall band, as soon as they are in.",
    off: "Students see only that a section is submitted. No band, no score, no overall — until this is switched back on.",
  },
  {
    key: "showCorrectAnswers",
    label: "Show correct answers after a mock",
    on: "After a listening or reading section, students can open the marked paper: right and wrong, the correct answers, explanations.",
    off: "The marked paper stays closed. Students cannot see which answers were right or what the correct answers were.",
  },
  {
    key: "celebrateCompletion",
    label: "Celebrate a finished mock",
    on: "Confetti and a congratulations card when the last section is submitted.",
    off: "The results simply appear.",
  },
];

/**
 * The switches for what a mock shows its student afterwards. Saved as flipped.
 *
 * They apply to anything sat under exam timing — a full mock, an event, or a
 * single test started as a mock — and never to practice.
 */
export function MockSettingsEditor({ initial }: { initial: MockSettings }) {
  const [settings, setSettings] = useState<MockSettings>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (key: keyof MockSettings) => {
    const previous = settings;
    const next = { ...settings, [key]: !settings[key] };
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

  return (
    <section className="rounded-xl bg-white p-6 shadow-[0_1px_2px_rgba(11,17,32,.08)]">
      <h2 className="text-sm font-bold text-ink">After a mock</h2>
      <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-ink-muted">
        What a student is shown once they finish a mock — a full mock, a mock test event, or a
        single test sat under exam timing. Practice always shows everything. These are global:
        switching one back on reveals the results of every past mock, which is how you release
        them.
      </p>

      <ul className="mt-5 divide-y divide-rule">
        {SWITCHES.map((item) => {
          const on = settings[item.key];
          return (
            <li key={item.key} className="flex items-start justify-between gap-6 py-4">
              <div className="max-w-[56ch]">
                <p className="text-sm font-semibold text-ink">{item.label}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                  {on ? item.on : item.off}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={item.label}
                disabled={pending}
                onClick={() => toggle(item.key)}
                className={cn(
                  "relative mt-0.5 h-7 w-12 flex-none rounded-full transition disabled:opacity-60",
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
            </li>
          );
        })}
      </ul>

      {message && <p className="mt-3 text-[13px] font-bold text-ok">{message}</p>}
      {error && <p className="mt-3 text-[13px] font-bold text-bad">{error}</p>}
    </section>
  );
}
