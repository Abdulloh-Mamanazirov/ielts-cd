"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

/** Mirrors the reasons the auth routes redirect with. */
const FALLBACK_ERRORS: Record<string, string> = {
  invalid: "Enter your email and password.",
  credentials: "Email or password is incorrect",
  throttled: "Too many failed attempts. Try again in a few minutes.",
  taken: "That email already has an account.",
};

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // A native form post cannot read a JSON reply, so the route sends back a flag
  // instead. Only a reason travels in the URL, never what was typed.
  const failed = params.get("failed");
  const shown = formError ?? (failed ? FALLBACK_ERRORS[failed] ?? FALLBACK_ERRORS.invalid : null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});

    const data = Object.fromEntries(new FormData(event.currentTarget));

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (payload?.errors) setFieldErrors(payload.errors);
        else setFormError(payload?.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    /**
     * `action` and `method` are the no-JavaScript path, and they are load
     * bearing even when JavaScript works: if the page has not hydrated the
     * browser submits natively, and a form with no method defaults to GET —
     * which puts the password in the URL, the history and the server log.
     * Posting to the route means an unhydrated page still signs in.
     */
    <form
      onSubmit={submit}
      action={`/api/auth/${mode}`}
      method="post"
      className="space-y-4"
      noValidate
    >
      <input type="hidden" name="next" value={next} />
      {mode === "signup" && (
        <Field
          label="Full name"
          name="fullName"
          type="text"
          autoComplete="name"
          error={fieldErrors.fullName}
        />
      )}

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={fieldErrors.email}
      />

      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        error={fieldErrors.password}
        hint={mode === "signup" ? "At least 8 characters." : undefined}
      />

      {shown && (
        <p role="alert" className="rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">
          {shown}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-brand-red px-4 py-3 font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
      >
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>

      <p className="text-center text-sm text-ink-muted">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand-blue hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="font-semibold text-brand-blue hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  error,
  hint,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className="w-full rounded-lg border border-hairline px-3 py-2.5 text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/25"
      />
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-xs text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="mt-1 text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
