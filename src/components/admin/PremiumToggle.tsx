"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setPremium } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

export function PremiumToggle({
  userId,
  isPremium,
  name,
}: {
  userId: string;
  isPremium: boolean;
  name: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = (next: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await setPremium({ userId, isPremium: next, note });
      if (result.ok) {
        setAsking(false);
        setNote("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  // Granting asks for a reason; revoking does not, because the note it would
  // overwrite is the record of why access was given in the first place.
  if (asking) {
    return (
      <div className="flex w-full flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={`Why does ${name.split(" ")[0]} get premium?`}
          className="min-w-[200px] flex-1 rounded-[9px] bg-surface-alt px-3 py-2 text-[13px] outline-none focus:shadow-[inset_0_0_0_2px_#0154f8]"
        />
        <button
          type="button"
          onClick={() => apply(true)}
          disabled={pending}
          className="rounded-[9px] bg-brand-red-cta px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
        >
          {pending ? "Granting…" : "Grant"}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="rounded-[9px] bg-surface-alt px-3 py-2 text-[12.5px] font-bold text-ink-muted"
        >
          Cancel
        </button>
        {error && <p className="w-full text-xs font-semibold text-brand-red-cta">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => (isPremium ? apply(false) : setAsking(true))}
      disabled={pending}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-[10.5px] font-bold tracking-[0.1em] transition disabled:opacity-60",
        isPremium
          ? "bg-brand-red text-white hover:bg-ink"
          : "bg-surface-alt text-ink-subtle hover:bg-ink hover:text-white",
      )}
    >
      {pending ? "…" : isPremium ? "PREMIUM · REMOVE" : "GRANT PREMIUM"}
    </button>
  );
}
