import Link from "next/link";
import { notFound } from "next/navigation";

import { Celebration } from "@/components/app/Celebration";
import { LeaveFullscreen } from "@/components/app/LeaveFullscreen";
import { ContinueMock } from "@/components/app/MockProgress";
import { LogoMark } from "@/components/marketing/Brand";
import { SkillIcon } from "@/components/SkillIcon";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { revealsAnswers, revealsBands } from "@/lib/mock-settings";
import { loadMockSettings } from "@/lib/mock-settings-store";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SKILL_LABEL: Record<string, string> = {
  LISTENING: "Listening",
  READING: "Reading",
  WRITING: "Writing",
  SPEAKING: "Speaking",
};

/**
 * Where a student lands between the sections of a full mock, and at the end.
 *
 * Deliberately not the app shell. Mid-exam there is nothing to browse to; the
 * page is the sections done so far and one button. When the last section is
 * in, the results take the middle of the screen.
 */
export default async function FullMockProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/full-mock/${id}`);

  const [mock, settings] = await Promise.all([
    prisma.fullMock.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        status: true,
        overallBand: true,
        event: { select: { title: true, token: true } },
        // Speaking in an event is examined face to face; the band lives on the
        // participant rather than on an attempt.
        participant: { select: { speakingBand: true } },
        attempts: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            status: true,
            band: true,
            expiresAt: true,
            reviewRequested: true,
            test: { select: { skill: true, durationSeconds: true } },
          },
        },
      },
    }),
    loadMockSettings(),
  ]);
  if (!mock) notFound();

  const title = mock.event?.title ?? "Full mock";
  const next = mock.attempts.find((attempt) => attempt.status === "IN_PROGRESS");
  const finished = mock.status === "COMPLETED";
  const abandoned = mock.status === "ABANDONED";

  // Every section of a mock is a MOCK attempt, so the switches apply to all of it.
  const showBands = revealsBands(settings, "MOCK");
  const showAnswers = revealsAnswers(settings, "MOCK");

  return (
    <main className="min-h-dvh bg-surface-alt">
      <div className="mx-auto max-w-xl px-5 py-10 lg:py-14">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-3">
            <LogoMark size={26} />
            <span className="font-display text-[13px] text-ink">DN IELTS</span>
          </span>
          {/* A way out that keeps the mock: sections already opened keep their
              clocks, and the student can come back from the dashboard. */}
          {!finished && !abandoned && (
            <Link
              href="/dashboard"
              className="text-[11px] font-bold tracking-[0.14em] text-ink-subtle transition hover:text-ink"
            >
              SAVE AND LEAVE
            </Link>
          )}
        </div>

        <section className="mt-8 rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(11,17,32,.08)] lg:p-9">
          <p className="text-[10px] font-bold tracking-[0.22em] text-brand-red">
            {finished ? "RESULTS" : abandoned ? "MOCK ABANDONED" : "MOCK IN PROGRESS"}
          </p>
          <h1 className="mt-2 font-display text-[clamp(1.6rem,5vw,2.25rem)] leading-[1] tracking-[-0.03em] text-ink">
            {title}
          </h1>

          {finished && showBands && (
            <div className="mt-7 text-center">
              <p className="text-[10px] font-bold tracking-[0.22em] text-ink-subtle">OVERALL BAND</p>
              <p className="mt-1 font-display text-7xl leading-none text-brand-red">
                {mock.overallBand !== null ? mock.overallBand.toFixed(1) : "—"}
              </p>
              {mock.overallBand === null && (
                <p className="mx-auto mt-3 max-w-[40ch] text-sm leading-relaxed text-ink-muted">
                  Your essays are with the instructor. The overall band appears here once they are
                  marked.
                </p>
              )}
            </div>
          )}
          {finished && !showBands && (
            <p className="mx-auto mt-7 max-w-[44ch] text-center text-sm leading-relaxed text-ink-muted">
              Every section is in. Your results will be released by the instructor.
            </p>
          )}

          <ol className={cn("space-y-px bg-rule", finished ? "mt-7" : "mt-6")}>
            {mock.attempts.map((attempt) => {
              const done = attempt.status === "SUBMITTED";
              const isNext = attempt.id === next?.id;
              const skill = attempt.test.skill;
              const marked = attempt.band !== null;
              const row = (
                <>
                  <SkillIcon
                    skill={skill.toLowerCase()}
                    size={18}
                    className={cn(
                      "flex-none",
                      done ? "text-ok" : isNext ? "text-brand-blue" : "text-ink-faint",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{SKILL_LABEL[skill]}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      {Math.round(attempt.test.durationSeconds / 60)} min
                    </p>
                  </div>
                  {done ? (
                    <span className="font-display text-xl leading-none text-ink">
                      {marked && showBands ? (
                        attempt.band!.toFixed(1)
                      ) : !showBands ? (
                        <span className="text-[10px] font-bold tracking-[0.12em] text-ok">
                          SUBMITTED
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold tracking-[0.12em] text-ink-subtle">
                          {skill === "WRITING" || skill === "SPEAKING"
                            ? "AWAITING MARKING"
                            : "SUBMITTED"}
                        </span>
                      )}
                    </span>
                  ) : isNext ? (
                    <span className="text-[10px] font-bold tracking-[0.12em] text-brand-blue">
                      {attempt.expiresAt ? "IN PROGRESS" : "NEXT"}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold tracking-[0.12em] text-ink-faint">
                      {abandoned ? "NOT SAT" : "LOCKED"}
                    </span>
                  )}
                </>
              );

              return (
                <li key={attempt.id}>
                  {/* The marked paper opens only once the mock is over: mid-exam
                      the page is a corridor between sections, not a reading room.
                      And only if the instructor lets students see it at all. */}
                  {finished && done && marked && (showAnswers || showBands) ? (
                    <Link
                      href={`/dashboard/results/${attempt.id}`}
                      className={cn(
                        "flex items-center gap-4 px-4 py-3.5 transition hover:bg-surface-alt",
                        "bg-white",
                      )}
                    >
                      {row}
                    </Link>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center gap-4 px-4 py-3.5",
                        isNext ? "bg-brand-blue-soft" : "bg-white",
                      )}
                    >
                      {row}
                    </div>
                  )}
                </li>
              );
            })}
            {mock.participant?.speakingBand !== null &&
              mock.participant?.speakingBand !== undefined && (
                <li>
                  <div className="flex items-center gap-4 bg-white px-4 py-3.5">
                    <SkillIcon skill="speaking" size={18} className="flex-none text-ok" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink">Speaking</p>
                      <p className="mt-0.5 text-xs text-ink-subtle">Face to face with the instructor</p>
                    </div>
                    {showBands ? (
                      <span className="font-display text-xl leading-none text-ink">
                        {mock.participant.speakingBand.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold tracking-[0.12em] text-ok">DONE</span>
                    )}
                  </div>
                </li>
              )}
          </ol>

          <div className="mt-7">
            {finished ? (
              <Link
                href={mock.event ? `/join/${mock.event.token}` : "/dashboard"}
                className="flex items-center justify-center rounded-[10px] bg-ink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-ink/90"
              >
                {mock.event ? "Back to the mock test page" : "Open dashboard"}
              </Link>
            ) : abandoned ? (
              <Link
                href="/dashboard"
                className="flex items-center justify-center rounded-[10px] bg-ink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-ink/90"
              >
                Open dashboard
              </Link>
            ) : next ? (
              <>
                <ContinueMock
                  fullMockId={mock.id}
                  label={
                    next.expiresAt
                      ? `Resume ${SKILL_LABEL[next.test.skill].toLowerCase()}`
                      : `Continue to ${SKILL_LABEL[next.test.skill].toLowerCase()}`
                  }
                />
                <p className="mt-2.5 text-center text-xs text-ink-subtle">
                  {next.expiresAt
                    ? "This section's clock is already running."
                    : "The clock for this section starts when you press this."}
                </p>
              </>
            ) : null}
          </div>
        </section>

        {finished && <LeaveFullscreen />}
        {finished && settings.celebrateCompletion && (
          <Celebration
            mockId={mock.id}
            title={mock.event?.title ?? "the full mock"}
            overallBand={showBands ? mock.overallBand : null}
            withheld={!showBands}
          >
            {showBands && <dl className="flex justify-center gap-6">
              {mock.attempts.map((attempt) => (
                <div key={attempt.id}>
                  <dt className="text-[10px] font-bold tracking-[0.16em] text-ink-subtle">
                    {SKILL_LABEL[attempt.test.skill].slice(0, 1)}
                  </dt>
                  <dd className="mt-1 font-display text-2xl leading-none text-ink">
                    {attempt.band !== null ? attempt.band.toFixed(1) : "—"}
                  </dd>
                </div>
              ))}
              {mock.participant?.speakingBand !== null &&
                mock.participant?.speakingBand !== undefined && (
                  <div>
                    <dt className="text-[10px] font-bold tracking-[0.16em] text-ink-subtle">S</dt>
                    <dd className="mt-1 font-display text-2xl leading-none text-ink">
                      {mock.participant.speakingBand.toFixed(1)}
                    </dd>
                  </div>
                )}
            </dl>}
          </Celebration>
        )}
      </div>
    </main>
  );
}
