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
      reviewRequested: true,
      submittedAt: true,
      timeSpentSeconds: true,
      result: true,
      test: { select: { title: true, skill: true, totalQuestions: true } },
      writingSubmission: {
        select: {
          task1Text: true,
          task2Text: true,
          task1WordCount: true,
          task2WordCount: true,
          instructorBand: true,
          instructorFeedback: true,
          reviewedAt: true,
        },
      },
      speakingRecordings: {
        select: { id: true, part: true, promptIndex: true, durationSeconds: true },
        orderBy: [{ part: "asc" }, { promptIndex: "asc" }],
      },
    },
  });

  if (!attempt || !attempt.submittedAt) notFound();

  const stored = attempt.result as {
    verdicts?: QuestionVerdict[];
    isEstimate?: boolean;
    /** Speaking has no submission row, so its marking rides in the attempt. */
    instructorFeedback?: string;
  } | null;
  const verdicts = stored?.verdicts ?? [];
  const autoGraded = attempt.test.totalQuestions > 0;
  const feedback = attempt.writingSubmission?.instructorFeedback ?? stored?.instructorFeedback;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/dashboard" className="text-sm font-semibold text-brand-blue hover:underline">
        ← Back to dashboard
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-ink">{attempt.test.title}</h1>
      <p className="text-sm text-ink-muted">
        {attempt.mode === "MOCK" ? "Mock" : "Practice"} · {attempt.submittedAt.toLocaleString()}
        {attempt.timeSpentSeconds !== null && ` · ${formatDuration(attempt.timeSpentSeconds)}`}
      </p>

      <div className="mt-6 flex flex-wrap gap-4">
        {autoGraded && (
          <Stat label="Score" value={`${attempt.rawScore}/${attempt.test.totalQuestions}`} />
        )}
        <Stat
          label={
            attempt.band === null
              ? "Band"
              : stored?.isEstimate
                ? "Indicative band"
                : "Band"
          }
          value={attempt.band?.toFixed(1) ?? "—"}
          accent
        />
      </div>

      {attempt.band === null && !autoGraded && (
        <p className="mt-5 rounded-xl bg-brand-blue-soft px-5 py-4 text-sm leading-relaxed text-ink-muted">
          {attempt.reviewRequested ? (
            <>
              <strong className="font-bold text-ink">With your instructor.</strong>{" "}
              {attempt.test.skill === "WRITING" ? "Writing" : "Speaking"} is marked by a person,
              not a machine, so this has no band yet. It will appear here and on your dashboard
              once it has been reviewed.
            </>
          ) : (
            <>
              <strong className="font-bold text-ink">Kept for you.</strong> This was not sent to
              your instructor, so it has no band. Everything below is saved and stays on your
              dashboard.
            </>
          )}
        </p>
      )}

      {feedback && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-subtle">
            Instructor feedback
          </h2>
          <p className="whitespace-pre-wrap rounded-xl bg-white p-5 text-sm leading-relaxed text-ink shadow-[0_1px_2px_rgba(11,17,32,.08)]">
            {feedback}
          </p>
        </section>
      )}

      {attempt.writingSubmission && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-subtle">
            What you wrote
          </h2>

          <Essay
            label="Task 1"
            text={attempt.writingSubmission.task1Text}
            words={attempt.writingSubmission.task1WordCount}
          />
          {attempt.writingSubmission.task2Text !== null && (
            <Essay
              label="Task 2"
              text={attempt.writingSubmission.task2Text}
              words={attempt.writingSubmission.task2WordCount}
            />
          )}
        </section>
      )}

      {attempt.speakingRecordings.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-subtle">
            Your recordings
          </h2>

          <ul className="space-y-3">
            {attempt.speakingRecordings.map((recording) => (
              <li
                key={recording.id}
                className="rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(11,17,32,.08)]"
              >
                <p className="text-[11px] font-bold tracking-[0.16em] text-ink-subtle">
                  PART {recording.part} · QUESTION {(recording.promptIndex ?? 0) + 1}
                  {recording.durationSeconds ? ` · ${recording.durationSeconds}s` : ""}
                </p>
                <audio
                  controls
                  preload="none"
                  src={`/api/attempts/${attempt.id}/recordings/${recording.id}`}
                  className="mt-2 h-10 w-full"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {verdicts.length > 0 && (
        <>
          <h2 className="mt-8 mb-2 text-sm font-bold uppercase tracking-wide text-ink-subtle">
            Question breakdown
          </h2>

          <ul className="space-y-2">
            {verdicts.map((verdict) => (
              <li
                key={verdict.number}
                className={cn(
                  "rounded-lg px-4 py-3 text-sm",
                  verdict.correct ? "bg-ok-soft" : "bg-bad-soft",
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
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                    {verdict.explanation}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function Essay({ label, text, words }: { label: string; text: string; words: number }) {
  return (
    <article className="mt-3 rounded-xl bg-white p-5 shadow-[0_1px_2px_rgba(11,17,32,.08)]">
      <p className="text-[11px] font-bold tracking-[0.16em] text-ink-subtle">
        {label.toUpperCase()} · {words} {words === 1 ? "WORD" : "WORDS"}
      </p>
      {text.trim() ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{text}</p>
      ) : (
        <p className="mt-2 text-sm italic text-ink-subtle">Left blank.</p>
      )}
    </article>
  );
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} seconds`;
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white px-5 py-4 shadow-[0_1px_2px_rgba(11,17,32,.08)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className={cn("text-2xl font-bold", accent ? "text-brand-red" : "text-ink")}>{value}</p>
    </div>
  );
}
