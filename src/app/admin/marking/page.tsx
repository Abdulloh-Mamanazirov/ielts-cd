import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPage, EmptyState } from "@/components/admin/AdminPage";
import { prisma } from "@/lib/db";
import { INSTRUCTOR_MARKING_ENABLED } from "@/lib/features";
import { cn } from "@/lib/utils";

export default async function MarkingQueuePage() {
  // Parked feature: nothing reaches this queue while submission is off.
  if (!INSTRUCTOR_MARKING_ENABLED) redirect("/admin");

  const attempts = await prisma.attempt.findMany({
    where: {
      status: "SUBMITTED",
      // Only work the student asked to have marked. Practice they finished on
      // their own is theirs, not a job for the queue.
      reviewRequested: true,
      test: { skill: { in: ["WRITING", "SPEAKING"] } },
    },
    // Unmarked first, then oldest first — a queue, not a feed.
    orderBy: [{ band: { sort: "asc", nulls: "first" } }, { submittedAt: "asc" }],
    take: 60,
    select: {
      id: true,
      band: true,
      submittedAt: true,
      fullMockId: true,
      user: { select: { fullName: true, email: true } },
      test: { select: { title: true, skill: true } },
      writingSubmission: { select: { task1WordCount: true, task2WordCount: true } },
      _count: { select: { speakingRecordings: true } },
    },
  });

  const waiting = attempts.filter((attempt) => attempt.band === null);

  return (
    <AdminPage
      eyebrow="MARKING"
      title={waiting.length === 0 ? "Nothing waiting." : `${waiting.length} to mark.`}
      subtitle="Writing and speaking are marked by you. A band here is what puts the result on the student's dashboard and into any full mock it belongs to."
    >
      {attempts.length === 0 ? (
        <EmptyState>No writing or speaking has been submitted yet.</EmptyState>
      ) : (
        <ul className="space-y-px bg-rule">
          {attempts.map((attempt) => (
            <li key={attempt.id}>
              <Link
                href={`/admin/marking/${attempt.id}`}
                className="flex flex-wrap items-center gap-4 bg-white px-5 py-4 transition hover:bg-surface-muted"
              >
                <span
                  className={cn(
                    "w-20 shrink-0 text-[10px] font-bold tracking-[0.18em]",
                    attempt.band === null ? "text-brand-red-cta" : "text-ink-subtle",
                  )}
                >
                  {attempt.test.skill}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{attempt.user.fullName}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-subtle">
                    {attempt.test.title} · {attempt.submittedAt?.toLocaleDateString()}
                    {attempt.fullMockId && " · full mock"}
                  </p>
                </div>

                <span className="text-xs tabular-nums text-ink-subtle">
                  {attempt.test.skill === "WRITING"
                    ? `${(attempt.writingSubmission?.task1WordCount ?? 0) + (attempt.writingSubmission?.task2WordCount ?? 0)} words`
                    : `${attempt._count.speakingRecordings} recordings`}
                </span>

                {attempt.band === null ? (
                  <span className="rounded-full bg-brand-red-cta px-3 py-1 text-[10.5px] font-bold text-white">
                    TO MARK
                  </span>
                ) : (
                  <span className="font-display text-lg tabular-nums text-ok">
                    {attempt.band.toFixed(1)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
