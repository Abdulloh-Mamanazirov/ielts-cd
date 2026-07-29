import Link from "next/link";

import { AppShell } from "@/components/app/AppShell";
import { BandHistory, type BandPoint } from "@/components/app/BandHistory";
import { PageHeader } from "@/components/app/PageHeader";
import { StartPractice } from "@/components/app/StartPractice";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { fullMockBlockers } from "@/lib/full-mock/service";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const SKILLS = ["LISTENING", "READING", "WRITING", "SPEAKING"] as const;
const SKILL_LABEL: Record<string, string> = {
  LISTENING: "Listening",
  READING: "Reading",
  WRITING: "Writing",
  SPEAKING: "Speaking",
};

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  const [attempts, inProgress, testsBySkill] = await Promise.all([
    prisma.attempt.findMany({
      where: { userId: user.id, status: "SUBMITTED" },
      orderBy: { submittedAt: "asc" },
      select: {
        id: true,
        mode: true,
        rawScore: true,
        band: true,
        reviewRequested: true,
        submittedAt: true,
        test: { select: { title: true, skill: true, totalQuestions: true } },
      },
    }),
    prisma.attempt.findMany({
      // Sections of a full mock are resumed from the full mock page, in order.
      // Listing them here as loose unfinished tests would invite a student to
      // jump straight into section 3.
      where: { userId: user.id, status: "IN_PROGRESS", fullMockId: null },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true, test: { select: { title: true, skill: true } } },
    }),
    prisma.test.groupBy({
      by: ["skill"],
      where: { status: "PUBLISHED" },
      _count: { _all: true },
    }),
  ]);

  const fullMockReady = (await fullMockBlockers(user)).length === 0;

  const skillCounts = Object.fromEntries(
    testsBySkill.map((row) => [row.skill.toLowerCase(), row._count._all]),
  );

  const scored = attempts.filter((attempt) => attempt.band !== null);

  const points: BandPoint[] = scored.slice(-8).map((attempt) => ({
    id: attempt.id,
    band: attempt.band!,
    label: attempt.test.title,
    date:
      attempt.submittedAt?.toLocaleDateString(undefined, { day: "numeric", month: "short" }) ?? "",
  }));

  // Best band per skill, and the weakest of those — the one thing to act on.
  const bySkill = SKILLS.map((skill) => {
    const bands = scored
      .filter((attempt) => attempt.test.skill === skill)
      .map((attempt) => attempt.band!);
    return { skill, best: bands.length > 0 ? Math.max(...bands) : null };
  });

  const attempted = bySkill.filter((entry) => entry.best !== null);
  const weakest =
    attempted.length > 0
      ? attempted.reduce((low, entry) => (entry.best! < low.best! ? entry : low))
      : null;
  const best = scored.length > 0 ? Math.max(...scored.map((a) => a.band!)) : null;

  return (
    <AppShell user={user} current="/dashboard">
      <PageHeader
        eyebrow={`WELCOME BACK, ${user.fullName.split(" ")[0].toUpperCase()}`}
        title={
          weakest ? (
            // No forced break: at the smaller heading size this fits on one
            // line, and the header is meant to be a strip, not a billboard.
            <>{SKILL_LABEL[weakest.skill].toLowerCase()} needs the work.</>
          ) : (
            <>Let&apos;s find your baseline.</>
          )
        }
        subtitle={
          scored.length === 0
            ? "Sit your first test and your bands, progress and weak areas will appear here."
            : `${scored.length} test${scored.length === 1 ? "" : "s"} completed${
                best !== null ? ` · best band ${best.toFixed(1)}` : ""
              }`
        }
      />

      <div className="px-6 pb-16 pt-6 lg:px-10 lg:pt-8">
        <div className="mx-auto max-w-4xl space-y-px bg-rule">
          <StartPractice counts={skillCounts} fullMockReady={fullMockReady} />
          {inProgress.length > 0 && (
            <section className="bg-white p-6 lg:p-8">
              <h2 className="text-[10px] font-bold tracking-[0.22em] text-brand-blue">
                UNFINISHED
              </h2>
              <ul className="mt-4 space-y-2">
                {inProgress.map((attempt) => (
                  <li
                    key={attempt.id}
                    className="flex flex-wrap items-center gap-4 bg-brand-blue-soft px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-ink">{attempt.test.title}</p>
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        Started {attempt.startedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      href={`/attempt/${attempt.id}`}
                      className="rounded-[10px] bg-brand-blue px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-blue-dark"
                    >
                      Resume
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {points.length > 0 && <BandHistory points={points} />}

          {attempted.length > 0 && (
            <section className="bg-white p-6 lg:p-8">
              <h2 className="text-[10px] font-bold tracking-[0.22em] text-ink-subtle">
                BEST BY SKILL
              </h2>
              <dl className="mt-5 grid grid-cols-2 gap-px bg-rule lg:grid-cols-4">
                {bySkill.map((entry) => (
                  <div key={entry.skill} className="bg-white p-4">
                    <dt className="text-[10px] font-bold tracking-[0.18em] text-ink-subtle">
                      {SKILL_LABEL[entry.skill].toUpperCase()}
                    </dt>
                    <dd
                      className={cn(
                        "mt-2 font-display text-3xl leading-none tracking-[-0.02em]",
                        entry.best === null
                          ? "text-ink-faint"
                          : weakest?.skill === entry.skill
                            ? "text-brand-red"
                            : "text-ink",
                      )}
                    >
                      {entry.best !== null ? entry.best.toFixed(1) : "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {weakest && (
            <section className="bg-ink p-6 lg:p-8">
              <p className="text-[10px] font-bold tracking-[0.22em] text-brand-red">DO THIS NEXT</p>
              <p className="mt-3 max-w-[46ch] font-display text-xl leading-[1.15] tracking-[-0.01em] text-white">
                Sit one more {SKILL_LABEL[weakest.skill].toLowerCase()} test this week.
              </p>
              <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-white/60">
                It is your lowest band at {weakest.best!.toFixed(1)}, so it is where a point is
                cheapest to win.
              </p>
              <Link
                href={`/tests?skill=${weakest.skill.toLowerCase()}`}
                className="mt-6 inline-flex items-center gap-2.5 rounded-[10px] bg-white px-5 py-3 text-sm font-bold text-ink transition hover:bg-brand-red-cta hover:text-white"
              >
                Find a {SKILL_LABEL[weakest.skill].toLowerCase()} test
                <span aria-hidden>→</span>
              </Link>
            </section>
          )}

          <section className="bg-white p-6 lg:p-8">
            <h2 className="text-[10px] font-bold tracking-[0.22em] text-ink-subtle">
              COMPLETED TESTS
            </h2>

            {attempts.length === 0 ? (
              <p className="mt-6 bg-surface-alt p-10 text-center text-sm text-ink-subtle">
                No completed tests yet.
              </p>
            ) : (
              <ul className="mt-5 space-y-px bg-rule">
                {[...attempts].reverse().map((attempt) => (
                  <li
                    key={attempt.id}
                    className="flex flex-wrap items-center gap-4 bg-white py-4 transition hover:bg-surface-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-ink">{attempt.test.title}</p>
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        {attempt.mode === "MOCK" ? "Mock" : "Practice"} ·{" "}
                        {attempt.submittedAt?.toLocaleDateString()}
                      </p>
                    </div>
                    {attempt.test.totalQuestions > 0 && (
                      <span className="text-sm tabular-nums text-ink-muted">
                        {attempt.rawScore}/{attempt.test.totalQuestions}
                      </span>
                    )}
                    {/* Writing and speaking carry no band until the instructor
                        sets one, which is what makes null the right signal here. */}
                    {attempt.band === null ? (
                      <span className="rounded-full bg-surface-alt px-3 py-1 text-[11px] font-bold tracking-[0.04em] text-ink-subtle">
                        {attempt.reviewRequested ? "AWAITING MARKING" : "NOT SENT"}
                      </span>
                    ) : (
                      <span className="font-display text-xl tabular-nums text-ink">
                        {attempt.band.toFixed(1)}
                      </span>
                    )}
                    <Link
                      href={`/dashboard/results/${attempt.id}`}
                      className="text-sm font-bold text-brand-blue transition hover:text-brand-red-cta"
                    >
                      Review →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
