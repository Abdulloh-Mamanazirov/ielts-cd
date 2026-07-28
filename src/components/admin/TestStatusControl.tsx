"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setTestStatus } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const OPTIONS = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export function TestStatusControl({
  testId,
  status,
  blocked,
}: {
  testId: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  /** Listening with no audio: publishing would give students a silent test. */
  blocked: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (next: (typeof OPTIONS)[number]) => {
    if (next === status) return;
    setError(null);
    startTransition(async () => {
      const result = await setTestStatus({ testId, status: next });
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-px overflow-hidden rounded-[9px] bg-rule">
        {OPTIONS.map((option) => {
          const disabled = pending || (option === "PUBLISHED" && blocked);

          return (
            <button
              key={option}
              type="button"
              onClick={() => change(option)}
              disabled={disabled}
              title={
                option === "PUBLISHED" && blocked
                  ? "Upload the audio before publishing"
                  : undefined
              }
              className={cn(
                "px-3 py-2 text-[11px] font-bold tracking-[0.08em] transition",
                status === option
                  ? option === "PUBLISHED"
                    ? "bg-ok text-white"
                    : "bg-ink text-white"
                  : "bg-white text-ink-subtle hover:bg-surface-alt",
                disabled && status !== option && "cursor-not-allowed opacity-40",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      {error && <p className="w-full text-xs font-semibold text-brand-red-cta">{error}</p>}
    </div>
  );
}
