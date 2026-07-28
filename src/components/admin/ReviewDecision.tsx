"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { decideAnswerReview } from "@/app/admin/actions";

export function ReviewDecision({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (accept: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await decideAnswerReview({ reviewId, accept });
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => decide(true)}
        disabled={pending}
        className="rounded-[9px] bg-ok px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-ink disabled:opacity-60"
      >
        Accept
      </button>
      <button
        type="button"
        onClick={() => decide(false)}
        disabled={pending}
        className="rounded-[9px] bg-surface-alt px-4 py-2 text-[12.5px] font-bold text-ink-muted transition hover:bg-ink hover:text-white disabled:opacity-60"
      >
        Reject
      </button>
      {error && <p className="w-full text-xs font-semibold text-brand-red-cta">{error}</p>}
    </div>
  );
}
