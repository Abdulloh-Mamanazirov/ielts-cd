import Link from "next/link";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { StartFullMock } from "@/components/app/StartFullMock";
import { SkillIcon } from "@/components/SkillIcon";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { fullMockBlockers } from "@/lib/full-mock/service";
import { cn } from "@/lib/utils";

export const metadata = { title: "Full mock" };

const SKILL_LABEL: Record<string, string> = {
  LISTENING: "Listening",
  READING: "Reading",
  WRITING: "Writing",
  SPEAKING: "Speaking",
};

export default async function FullMockPage() {
  const user = await requireUser("/full-mock");

  const [blockers, current, past] = await Promise.all([
    fullMockBlockers(user),
    prisma.fullMock.findFirst({
      where: { userId: user.id, status: "IN_PROGRESS" },
      select: {
        id: true,
        startedAt: true,
        includeSpeaking: true,
        attempts: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            status: true,
            sequence: true,
            band: true,
            expiresAt: true,
            test: { select: { title: true, skill: true, durationSeconds: true } },
          },
        },
      },
    }),
    prisma.fullMock.findMany({
      where: { userId: user.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 8,
      select: {
        id: true,
        completedAt: true,
        overallBand: true,
        attempts: {
          orderBy: { sequence: "asc" },
          select: { id: true, band: true, test: { select: { skill: true, title: true } } },
        },
      },
    }),
  ]);

  const ready = blockers.length === 0;

  return (
    <AppShell user={user} current="/full-mock">
      <PageHeader
        eyebrow="FULL MOCK"
        title="All four skills, one sitting."
        subtitle={
          ready
            ? "One test per skill, chosen for you, sat back to back under exam timing. Each section is timed on its own and starts when you open it."
            : `Not available yet — there is no sittable test for ${blockers
                .map((skill) => SKILL_LABEL[skill].toLowerCase())
                .join(", ")}.`
        }
      />

      <div className="px-6 pb-16 pt-6 lg:px-10 lg:pt-8">
        <div className="mx-auto max-w-4xl space-y-px bg-rule">
          {current ? (
            <section className="bg-white px-6 py-6 lg:px-8">
              <h2 className="text-[10px] font-bold tracking-[0.22em] text-brand-blue">
                IN PROGRESS
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                Started {current.startedAt.toLocaleDateString()}. Sections run in exam order; each
                clock starts the moment you open that section.
              </p>

              <ol className="mt-5 space-y-px bg-rule">
                {current.attempts.map((attempt) => {
                  const done = attempt.status === "SUBMITTED";
                  const isNext =
                    !done &&
                    current.attempts.find((a) => a.status === "IN_PROGRESS")?.id === attempt.id;

                  return (
                    <li
                      key={attempt.id}
                      className={cn(
                        "flex flex-wrap items-center gap-4 px-5 py-4",
                        isNext ? "bg-brand-blue-soft" : "bg-white",
                      )}
                    >
                      <SkillIcon
                        skill={attempt.test.skill.toLowerCase()}
                        size={18}
                        className={cn(
                          "flex-none",
                          done ? "text-ok" : isNext ? "text-brand-blue" : "text-ink-faint",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">
                          {SKILL_LABEL[attempt.test.skill]}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-ink-subtle">
                          {attempt.test.title} · {Math.round(attempt.test.durationSeconds / 60)} min
                        </p>
                      </div>

                      {done ? (
                        <span className="text-[11px] font-bold tracking-[0.08em] text-ok">
                          {attempt.band !== null ? attempt.band.toFixed(1) : "SUBMITTED"}
                        </span>
                      ) : isNext ? (
                        <span className="text-[11px] font-bold tracking-[0.08em] text-brand-blue">
                          {attempt.expiresAt ? "RESUME" : "NEXT"}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold tracking-[0.08em] text-ink-faint">
                          LOCKED
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>

              <StartFullMock mode="continue" fullMockId={current.id} />
            </section>
          ) : (
            <section className="bg-white px-6 py-6 lg:px-8">
              <h2 className="text-[10px] font-bold tracking-[0.22em] text-ink-subtle">
                START A MOCK
              </h2>
              <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-muted">
                One test is picked per skill. You will not be given a test you have already sat
                unless you have sat them all, and you will only be offered tests your account can
                open.
              </p>

              {ready ? (
                <StartFullMock mode="start" />
              ) : (
                <p className="mt-5 rounded-[10px] bg-surface-alt px-4 py-3 text-sm text-ink-subtle">
                  Ask your instructor to publish a {blockers.map((s) => SKILL_LABEL[s].toLowerCase()).join(" and ")} test.
                </p>
              )}
            </section>
          )}

          {past.length > 0 && (
            <section className="bg-white px-6 py-6 lg:px-8">
              <h2 className="text-[10px] font-bold tracking-[0.22em] text-ink-subtle">
                COMPLETED MOCKS
              </h2>

              <ul className="mt-4 space-y-px bg-rule">
                {past.map((mock) => (
                  <li key={mock.id} className="bg-white px-5 py-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-ink">
                          {mock.completedAt?.toLocaleDateString()}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-subtle">
                          {mock.attempts.length} sections
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9.5px] font-bold tracking-[0.18em] text-ink-subtle">
                          OVERALL
                        </p>
                        <p className="mt-0.5 font-display text-xl leading-none text-brand-red">
                          {mock.overallBand?.toFixed(1) ?? "—"}
                        </p>
                      </div>
                    </div>

                    <ul className="mt-3 flex flex-wrap gap-2">
                      {mock.attempts.map((attempt) => (
                        <li key={attempt.id}>
                          <Link
                            href={`/dashboard/results/${attempt.id}`}
                            className="inline-flex items-center gap-2 rounded-[9px] bg-surface-alt px-3 py-1.5 text-[12px] font-semibold text-ink-muted transition hover:bg-ink hover:text-white"
                          >
                            {SKILL_LABEL[attempt.test.skill]}
                            <span className="font-bold tabular-nums">
                              {attempt.band?.toFixed(1) ?? "—"}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>

                    {mock.overallBand === null && (
                      <p className="mt-3 text-xs text-ink-subtle">
                        The overall band appears once your instructor has marked every section.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
