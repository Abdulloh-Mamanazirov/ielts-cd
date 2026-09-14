"use client";

import { useState, useTransition } from "react";

import { updateMarkingSettings } from "@/app/admin/actions";
import type { MarkingSettings } from "@/lib/marking-settings";
import { cn } from "@/lib/utils";

const PLANS = [
  { key: "FREE", label: "Free" },
  { key: "STUDENT", label: "Student" },
  { key: "PREMIUM", label: "Premium" },
] as const;

/**
 * One switch per plan for instructor marking. Saved as flipped, like the
 * sign-up switch above it.
 */
export function MarkingSettingsEditor({ initial }: { initial: MarkingSettings }) {
  const [settings, setSettings] = useState<MarkingSettings>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (plan: keyof MarkingSettings) => {
    const previous = settings;
    const next = { ...settings, [plan]: !settings[plan] };
    setSettings(next);
    setMessage(null);
    setError(null);
    start(async () => {
      const result = await updateMarkingSettings(next);
      if (result.ok) setMessage(result.message);
      else {
        setSettings(previous);
        setError(result.error);
      }
    });
  };

  return (
    <section className="rounded-xl bg-white p-6 shadow-[0_1px_2px_rgba(11,17,32,.08)]">
      <h2 className="text-sm font-bold text-ink">Instructor marking</h2>
      <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-ink-muted">
        Which plans can send writing and speaking to you for a band. Off for a plan means those
        students still sit the tests and keep their work; it just does not reach your marking
        queue. <strong className="font-semibold text-ink">Mock event essays are always marked</strong>,
        whatever the student&apos;s plan.
      </p>

      <ul className="mt-5 divide-y divide-rule">
        {PLANS.map((plan) => (
          <li key={plan.key} className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm font-semibold text-ink">{plan.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings[plan.key]}
              aria-label={`Marking for ${plan.label}`}
              disabled={pending}
              onClick={() => toggle(plan.key)}
              className={cn(
                "relative h-7 w-12 flex-none rounded-full transition disabled:opacity-60",
                settings[plan.key] ? "bg-ok" : "bg-ink/20",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
                  settings[plan.key] ? "left-6" : "left-1",
                )}
              />
            </button>
          </li>
        ))}
      </ul>

      {message && <p className="mt-3 text-[13px] font-bold text-ok">{message}</p>}
      {error && <p className="mt-3 text-[13px] font-bold text-bad">{error}</p>}
    </section>
  );
}
