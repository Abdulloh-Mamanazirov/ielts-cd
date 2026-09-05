"use client";

import { useState, useTransition } from "react";

import { updateAuthSettings } from "@/app/admin/actions";
import type { AuthSettings } from "@/lib/auth-settings";
import { cn } from "@/lib/utils";

/**
 * The switch for email registration.
 *
 * Saved as soon as it is flipped rather than behind a Save button: there is one
 * setting, and a switch that needs confirming reads as broken.
 */
export function AuthSettingsEditor({ initial }: { initial: AuthSettings }) {
  const [settings, setSettings] = useState<AuthSettings>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (emailSignup: boolean) => {
    const previous = settings;
    setSettings({ emailSignup });
    setMessage(null);
    setError(null);

    start(async () => {
      const result = await updateAuthSettings({ emailSignup });
      if (result.ok) setMessage(result.message);
      else {
        setSettings(previous);
        setError(result.error);
      }
    });
  };

  return (
    <section className="rounded-xl bg-white p-6 shadow-[0_1px_2px_rgba(11,17,32,.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[62ch]">
          <h2 className="text-sm font-bold text-ink">Email sign-up</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
            When this is off, the sign-up page offers Telegram only and the email form is
            hidden. Signing <em>in</em> with an email is never affected, so students who
            already have one keep their accounts either way.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={settings.emailSignup}
          aria-label="Email sign-up"
          disabled={pending}
          onClick={() => set(!settings.emailSignup)}
          className={cn(
            "relative h-7 w-12 flex-none rounded-full transition disabled:opacity-60",
            settings.emailSignup ? "bg-ok" : "bg-ink/20",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
              settings.emailSignup ? "left-6" : "left-1",
            )}
          />
        </button>
      </div>

      <p className="mt-4 text-[13px] font-bold">
        <span className={settings.emailSignup ? "text-ok" : "text-ink-subtle"}>
          {settings.emailSignup
            ? "Open — visitors can register with an email and password."
            : "Closed — new accounts come through Telegram."}
        </span>
      </p>

      {message && <p className="mt-2 text-[13px] font-bold text-ok">{message}</p>}
      {error && <p className="mt-2 text-[13px] font-bold text-bad">{error}</p>}
    </section>
  );
}
