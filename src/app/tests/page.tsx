import Link from "next/link";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { describeTest, isSkillSlug, skillBySlug } from "@/lib/skills";
import { cn } from "@/lib/utils";

export const metadata = { title: "Practice tests" };

const SKILL_LABEL: Record<string, string> = {
  LISTENING: "Listening",
  READING: "Reading",
  WRITING: "Writing",
  SPEAKING: "Speaking",
};

export default async function TestsPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  const { skill } = await searchParams;
  const user = await requireUser("/tests");

  const active = isSkillSlug(skill) ? skillBySlug(skill) : undefined;

  const [tests, attempts] = await Promise.all([
    prisma.test.findMany({
      where: {
        status: "PUBLISHED",
        ...(active ? { skill: active.db } : {}),
      },
      orderBy: [{ skill: "asc" }, { isPremium: "asc" }, { title: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        skill: true,
        isPremium: true,
        totalQuestions: true,
        durationSeconds: true,
      },
    }),
    prisma.attempt.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      select: { id: true, testId: true, status: true, band: true },
    }),
  ]);

  // One row, one state — so the eye can scan a single column for status.
  const stateFor = (testId: string) => {
    const inProgress = attempts.find((a) => a.testId === testId && a.status === "IN_PROGRESS");
    if (inProgress) return { kind: "in_progress" as const, attempt: inProgress };
    const done = attempts.find((a) => a.testId === testId && a.status === "SUBMITTED");
    if (done) return { kind: "completed" as const, attempt: done };
    return { kind: "available" as const, attempt: null };
  };

  const hasPremium = user.isPremium || user.role === "ADMIN";

  return (
    <AppShell user={user} current={active ? `/tests?skill=${active.slug}` : "/tests"}>
      <PageHeader
        eyebrow={active ? active.name.toUpperCase() : "PRACTICE TESTS"}
        title={active ? `${active.name} tests.` : "Choose a test."}
        subtitle={
          hasPremium
            ? "You have access to every test, free and premium."
            : "Free tests are open to you. Premium tests unlock when your instructor grants access."
        }
      />

      {/* No skill filter row: the sidebar already picks the skill, and a second
          set of controls saying the same thing only competes with it. */}
      <div className="px-6 pb-16 pt-6 lg:px-10 lg:pt-8">
        <ul className="mx-auto max-w-4xl space-y-px bg-rule">
          {tests.map((test) => {
            const locked = test.isPremium && !hasPremium;
            const state = stateFor(test.id);

            return (
              <li
                key={test.id}
                className={cn(
                  "group flex flex-wrap items-center gap-4 bg-white px-5 py-4 transition",
                  locked ? "opacity-70 hover:opacity-100" : "hover:bg-surface-muted",
                )}
              >
                <span
                  className={cn(
                    "w-24 shrink-0 text-[10px] font-bold tracking-[0.2em]",
                    locked ? "text-ink-subtle" : "text-brand-blue",
                  )}
                >
                  {SKILL_LABEL[test.skill].toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{test.title}</p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    {describeTest(test.totalQuestions, test.durationSeconds)}
                    {test.isPremium && " · Premium"}
                  </p>
                </div>

                <StatusTag state={state.kind} locked={locked} band={state.attempt?.band ?? null} />

                <Action
                  locked={locked}
                  state={state.kind}
                  slug={test.slug}
                  attemptId={state.attempt?.id}
                />
              </li>
            );
          })}
        </ul>

        {/* The upgrade band earns its place at the end rather than nagging from
            a modal or a sticky bar. */}
        {!hasPremium && tests.some((test) => test.isPremium) && (
          <div className="mx-auto mt-6 max-w-4xl bg-ink p-7 lg:p-9">
            <p className="text-[10px] font-bold tracking-[0.22em] text-brand-red">PREMIUM</p>
            <h2 className="mt-3 max-w-[24ch] font-display text-2xl leading-[1.05] tracking-[-0.02em] text-white">
              Full Cambridge mocks, marked the moment you finish.
            </h2>
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-white/65">
              Premium access is granted by your instructor. Message him on Telegram and he will
              unlock it on your account.
            </p>
            <a
              href="https://t.me/ielts_army_uz"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-3 rounded-[10px] bg-brand-red-cta px-6 py-3.5 text-sm font-bold text-white transition hover:bg-brand-red-dark"
            >
              Ask for premium access
              <span aria-hidden>→</span>
            </a>
          </div>
        )}

        {tests.length === 0 && (
          <p className="mx-auto max-w-4xl bg-white p-12 text-center text-sm text-ink-subtle">
            {active
              ? `No ${active.name.toLowerCase()} tests are published yet.`
              : "No tests published yet."}
          </p>
        )}
      </div>
    </AppShell>
  );
}

function StatusTag({
  state,
  locked,
  band,
}: {
  state: "in_progress" | "completed" | "available";
  locked: boolean;
  band: number | null;
}) {
  if (locked) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-ink-subtle">
        <LockIcon />
        LOCKED
      </span>
    );
  }

  if (state === "in_progress") {
    return (
      <span className="rounded-full bg-brand-blue-soft px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-brand-blue">
        IN PROGRESS
      </span>
    );
  }

  if (state === "completed") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-ok-soft px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-ok">
        ✓ DONE
        {band !== null && <strong className="text-xs">{band.toFixed(1)}</strong>}
      </span>
    );
  }

  return <span className="w-[92px]" aria-hidden />;
}

function Action({
  locked,
  state,
  slug,
  attemptId,
}: {
  locked: boolean;
  state: "in_progress" | "completed" | "available";
  slug: string;
  attemptId?: string;
}) {
  if (locked) {
    return (
      <span className="rounded-[10px] px-5 py-2.5 text-sm font-bold text-ink-subtle shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.16)]">
        Unlock
      </span>
    );
  }

  if (state === "in_progress" && attemptId) {
    return (
      <Link
        href={`/attempt/${attemptId}`}
        className="rounded-[10px] bg-brand-blue px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-blue-dark"
      >
        Resume
      </Link>
    );
  }

  return (
    <Link
      href={`/tests/${slug}`}
      className="rounded-[10px] bg-brand-red-cta px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-red-dark"
    >
      {state === "completed" ? "Retake" : "Start"}
    </Link>
  );
}

function LockIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
