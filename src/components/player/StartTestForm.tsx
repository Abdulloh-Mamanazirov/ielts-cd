"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

/** The two modes from the source files: untimed practice, or a strict mock. */
export function StartTestForm({
  testId,
  durationMinutes,
  skill,
}: {
  testId: string;
  durationMinutes: number;
  skill: "listening" | "reading" | "writing" | "speaking";
}) {
  const router = useRouter();
  const [starting, setStarting] = useState<"PRACTICE" | "MOCK" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (mode: "PRACTICE" | "MOCK") => {
    setStarting(mode);
    setError(null);

    // Enter fullscreen for the exam. Requested here, inside the click gesture
    // and before any await, which is what browsers require; it carries through
    // the client-side navigation into the player. Best-effort — a browser that
    // refuses or lacks the API just stays in a normal window.
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      /* fullscreen unavailable — continue windowed */
    }

    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, mode }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "Could not start the test.");
        return;
      }

      router.push(`/attempt/${data.attempt.id}`);
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setStarting(null);
    }
  };

  // Writing and speaking are marked by a person, so practice cannot promise
  // explanations and a mock cannot promise a band the moment time runs out.
  const marked = skill === "writing" || skill === "speaking";

  return (
    <div className="mt-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <ModeCard
          title="Practice"
          subtitle="Untimed"
          description={
            marked
              ? skill === "speaking"
                ? "Take your time, re-record any answer, and listen back before you send it."
                : "Take your time over the prompt, and keep editing until you are happy with it."
              : "Pause whenever you like, then check your answers with explanations."
          }
          points={[
            "Timer can be paused",
            marked
              ? skill === "speaking"
                ? "Re-record and listen back"
                : "Edit until you submit"
              : "Answers explained afterwards",
            "Saved to your progress",
          ]}
          accent="ok"
          busy={starting === "PRACTICE"}
          disabled={starting !== null}
          onClick={() => start("PRACTICE")}
        />
        <ModeCard
          title="Mock"
          subtitle={`${durationMinutes} minutes`}
          description="The real thing: a countdown you cannot pause, submitted automatically when time runs out."
          points={[
            "No pausing",
            "Auto-submits at zero",
            marked ? "Marked by your instructor" : "Counts towards your progress",
          ]}
          accent="blue"
          busy={starting === "MOCK"}
          disabled={starting !== null}
          onClick={() => start("MOCK")}
        />
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function ModeCard({
  title,
  subtitle,
  description,
  points,
  accent,
  busy,
  disabled,
  onClick,
}: {
  title: string;
  subtitle: string;
  description: string;
  points: string[];
  accent: "ok" | "blue";
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-2xl border-2 border-hairline bg-white p-5 text-left transition",
        "hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-wait disabled:opacity-70",
        accent === "ok" ? "hover:border-ok" : "hover:border-brand-blue",
      )}
    >
      <p className="text-lg font-bold text-ink">{title}</p>
      <p
        className={cn(
          "text-xs font-bold uppercase tracking-wide",
          accent === "ok" ? "text-ok" : "text-brand-blue",
        )}
      >
        {subtitle}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</p>
      <ul className="mt-3 space-y-1 text-sm text-ink-muted">
        {points.map((point) => (
          <li key={point} className="flex gap-2">
            <span className={accent === "ok" ? "text-ok" : "text-brand-blue"}>✓</span>
            {point}
          </li>
        ))}
      </ul>
      <span
        className={cn(
          "mt-4 block rounded-full px-4 py-2 text-center text-sm font-bold text-white",
          accent === "ok" ? "bg-ok" : "bg-brand-blue",
        )}
      >
        {busy ? "Starting…" : `Start ${title.toLowerCase()}`}
      </span>
    </button>
  );
}
