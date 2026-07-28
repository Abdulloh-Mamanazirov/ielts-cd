import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import type { QuestionVerdict } from "@/lib/tests/grade";
import { cn } from "@/lib/utils";

export const metadata = { title: "Result" };

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/results/${id}`);

  const attempt = await prisma.attempt.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      mode: true,
      rawScore: true,
      band: true,
      submittedAt: true,
      timeSpentSeconds: true,
      result: true,
      test: { select: { title: true, skill: true, totalQuestions: true } },
    },
  });

  if (!attempt || !attempt.submittedAt) notFound();

  const stored = attempt.result as { verdicts?: QuestionVerdict[]; isEstimate?: boolean } | null;
  const verdicts = stored?.verdicts ?? [];

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/dashboard" className="text-sm font-semibold text-brand-blue hover:underline">
        ← Back to dashboard
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-ink">{attempt.test.title}</h1>
      <p className="text-sm text-ink-muted">
        {attempt.mode === "MOCK" ? "Mock" : "Practice"} ·{" "}
        {attempt.submittedAt.toLocaleString()}
        {attempt.timeSpentSeconds !== null &&
          ` · ${formatDuration(attempt.timeSpentSeconds)}`}
      </p>

      <div className="mt-6 flex flex-wrap gap-4">
        <Stat label="Score" value={`${attempt.rawScore}/${attempt.test.totalQuestions}`} />
        <Stat
          label={stored?.isEstimate ? "Indicative band" : "Band"}
          value={attempt.band?.toFixed(1) ?? "—"}
          accent
        />
      </div>

      <h2 className="mt-8 mb-2 text-sm font-bold uppercase tracking-wide text-ink-subtle">
        Question breakdown
      </h2>

      <ul className="space-y-2">
        {verdicts.map((verdict) => (
          <li
            key={verdict.number}
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              verdict.correct ? "border-ok/30 bg-ok-soft" : "border-bad/30 bg-bad-soft",
            )}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-bold text-ink">Q{verdict.number}</span>
              <span className={verdict.correct ? "text-ok" : "text-bad"}>
                {verdict.submitted || <em className="text-ink-subtle">no answer</em>}
              </span>
              {!verdict.correct && (
                <span className="text-ink-muted">
                  → <strong className="text-ok">{verdict.expected}</strong>
                </span>
              )}
              {verdict.type && (
                <span className="ml-auto text-xs text-ink-subtle">{verdict.type}</span>
              )}
            </div>
            {!verdict.correct && verdict.explanation && (
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{verdict.explanation}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} seconds`;
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-hairline bg-white px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className={cn("text-2xl font-bold", accent ? "text-brand-red" : "text-ink")}>{value}</p>
    </div>
  );
}
