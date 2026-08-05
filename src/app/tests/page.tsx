import Link from "next/link";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { describeTest, isSkillSlug, skillBySlug } from "@/lib/skills";
import { allowsSeries, allowsTest, effectivePlan } from "@/lib/plans";
import { loadPlans } from "@/lib/plans-store";
import { cn, naturalCompare } from "@/lib/utils";

export const metadata = { title: "Practice tests" };

const SKILL_LABEL: Record<string, string> = {
  LISTENING: "Listening",
  READING: "Reading",
  WRITING: "Writing",
  SPEAKING: "Speaking",
};

/**
 * The shelf for listening and reading is browsed in three steps — body of
 * material, then book or volume, then the tests — because one list of nearly a
 * hundred papers is not a thing anyone can choose from. Writing and speaking
 * have too few tests to be worth the extra clicks, so they stay a flat list.
 */
const SERIES = {
  cambridge: {
    db: "CAMBRIDGE" as const,
    name: "Cambridge materials",
    blurb: "The official Cambridge IELTS books, exactly as they are printed.",
    setLabel: (n: number) => `Cambridge ${n}`,
    setEyebrow: "BOOK",
  },
  "real-exam": {
    db: "REAL_EXAM" as const,
    name: "Real Exam materials",
    blurb: "Papers collected from recent real exams, grouped into Volumes.",
    setLabel: (n: number) => `Volume ${n}`,
    setEyebrow: "VOLUME",
  },
};

type SeriesSlug = keyof typeof SERIES;

function isSeriesSlug(value: string | undefined): value is SeriesSlug {
  return value === "cambridge" || value === "real-exam";
}

export default async function TestsPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; series?: string; set?: string }>;
}) {
  const { skill, series, set } = await searchParams;
  const user = await requireUser("/tests");

  const active = isSkillSlug(skill) ? skillBySlug(skill) : undefined;

  // Only the two graded skills are deep enough to be worth grouping.
  const grouped = active?.db === "READING" || active?.db === "LISTENING";
  const seriesSlug = grouped && isSeriesSlug(series) ? series : undefined;
  const setNumber = seriesSlug && set && /^\d+$/.test(set) ? Number(set) : undefined;

  const level: "categories" | "sets" | "tests" = !grouped
    ? "tests"
    : !seriesSlug
      ? "categories"
      : setNumber === undefined
        ? "sets"
        : "tests";

  const [tests, attempts] = await Promise.all([
    prisma.test.findMany({
      where: {
        status: "PUBLISHED",
        // Material reserved for full mocks never appears on the practice shelf.
        mockOnly: false,
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
        series: true,
        seriesNumber: true,
        testNumber: true,
      },
    }),
    prisma.attempt.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      select: { id: true, testId: true, status: true, band: true },
    }),
  ]);

  // The database can only sort titles lexicographically, which files "Test 10"
  // between "Test 1" and "Test 2". Re-sort here so the numbers read in order.
  tests.sort(
    (a, b) =>
      a.skill.localeCompare(b.skill) ||
      Number(a.isPremium) - Number(b.isPremium) ||
      naturalCompare(a.title, b.title),
  );

  // One row, one state — so the eye can scan a single column for status.
  const stateFor = (testId: string) => {
    const inProgress = attempts.find((a) => a.testId === testId && a.status === "IN_PROGRESS");
    if (inProgress) return { kind: "in_progress" as const, attempt: inProgress };
    const done = attempts.find((a) => a.testId === testId && a.status === "SUBMITTED");
    if (done) return { kind: "completed" as const, attempt: done };
    return { kind: "available" as const, attempt: null };
  };

  const plans = await loadPlans();
  const plan = effectivePlan(user);
  const hasPremium = user.isPremium || user.role === "ADMIN";

  /** Whether the subscription opens a given book or volume of a series. */
  const opens = (series: "REAL_EXAM" | "CAMBRIDGE", seriesNumber: number | null) =>
    user.role === "ADMIN" || allowsSeries(plans[plan].access[series], seriesNumber);

  /** Whether it opens a particular test — writing and speaking always do. */
  const opensTest = (test: {
    skill: "LISTENING" | "READING" | "WRITING" | "SPEAKING";
    series: "REAL_EXAM" | "CAMBRIDGE";
    seriesNumber: number | null;
  }) => user.role === "ADMIN" || allowsTest(plans, plan, test);

  const submitted = new Set(
    attempts.filter((attempt) => attempt.status === "SUBMITTED").map((a) => a.testId),
  );

  // Narrow to whatever this level is showing.
  const inSeries = seriesSlug
    ? tests.filter((test) => test.series === SERIES[seriesSlug].db)
    : tests;
  const visible =
    setNumber === undefined
      ? inSeries
      : inSeries.filter((test) => test.seriesNumber === setNumber);

  // The books or volumes inside the chosen library, each with its own progress.
  const sets = [...new Set(inSeries.map((test) => test.seriesNumber ?? 0))]
    .sort((a, b) => a - b)
    .map((number) => {
      const members = inSeries.filter((test) => (test.seriesNumber ?? 0) === number);
      return {
        number,
        total: members.length,
        done: members.filter((test) => submitted.has(test.id)).length,
        locked: seriesSlug ? !opens(SERIES[seriesSlug].db, number || null) : false,
      };
    });

  const base = `/tests?skill=${active?.slug ?? ""}`;

  return (
    <AppShell user={user} current={active ? `/tests?skill=${active.slug}` : "/tests"}>
      <PageHeader
        eyebrow={active ? active.name.toUpperCase() : "PRACTICE TESTS"}
        title={
          level === "categories" && active
            ? `${active.name}: choose your material.`
            : level === "sets" && seriesSlug
              ? `${SERIES[seriesSlug].name}.`
              : active
                ? `${active.name} tests.`
                : "Choose a test."
        }
        subtitle={
          level === "categories"
            ? "Two libraries: the official Cambridge books, and papers collected from recent real exams."
            : level === "sets" && seriesSlug
              ? SERIES[seriesSlug].blurb
              : hasPremium
                ? "You have access to every test, free and premium."
                : "Free tests are open to you. Premium tests unlock when your instructor grants access."
        }
      />

      {/* No skill filter row: the sidebar already picks the skill, and a second
          set of controls saying the same thing only competes with it. */}
      <div className="px-6 pb-16 pt-6 lg:px-10 lg:pt-8">
        {grouped && seriesSlug && (
          <nav
            aria-label="Breadcrumb"
            className="mx-auto mb-5 flex max-w-4xl items-center gap-2 text-xs font-bold text-ink-subtle"
          >
            <Link href={base} className="transition hover:text-brand-blue">
              {active?.name}
            </Link>
            <span aria-hidden>/</span>
            {level === "tests" && setNumber !== undefined ? (
              <>
                <Link
                  href={`${base}&series=${seriesSlug}`}
                  className="transition hover:text-brand-blue"
                >
                  {SERIES[seriesSlug].name}
                </Link>
                <span aria-hidden>/</span>
                <span className="text-ink">{SERIES[seriesSlug].setLabel(setNumber)}</span>
              </>
            ) : (
              <span className="text-ink">{SERIES[seriesSlug].name}</span>
            )}
          </nav>
        )}

        {level === "categories" && (
          <ul className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
            {(Object.keys(SERIES) as SeriesSlug[]).map((key, index) => {
              const count = tests.filter((test) => test.series === SERIES[key].db).length;

              return (
                <li
                  key={key}
                  className="animate-[var(--animate-rise)]"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <Link
                    href={`${base}&series=${key}`}
                    className="group flex h-full flex-col rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(11,17,32,.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_50px_-24px_rgba(11,17,32,.35)]"
                  >
                    <span className="text-[10px] font-bold tracking-[0.22em] text-brand-red">
                      {count} TEST{count === 1 ? "" : "S"}
                    </span>
                    <h2 className="mt-3 font-display text-2xl leading-tight tracking-[-0.02em] text-ink">
                      {SERIES[key].name}
                    </h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">
                      {SERIES[key].blurb}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-blue">
                      Browse
                      <span
                        aria-hidden
                        className="transition-transform duration-300 group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {level === "sets" && seriesSlug && (
          <ul className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sets.map((entry, index) => (
              <li
                key={entry.number}
                className="animate-[var(--animate-rise)]"
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <Link
                  href={
                    entry.locked ? "/pricing" : `${base}&series=${seriesSlug}&set=${entry.number}`
                  }
                  className={cn(
                    "group flex flex-col rounded-xl bg-white p-5 shadow-[0_1px_2px_rgba(11,17,32,.08)] transition duration-300",
                    entry.locked
                      ? "opacity-65 hover:opacity-100"
                      : "hover:-translate-y-1 hover:shadow-[0_22px_40px_-22px_rgba(11,17,32,.35)]",
                  )}
                >
                  <span className="flex items-center justify-between text-[10px] font-bold tracking-[0.2em] text-ink-subtle">
                    {SERIES[seriesSlug].setEyebrow}
                    {entry.locked && <LockIcon />}
                  </span>
                  <span className="mt-1 font-display text-xl text-ink">
                    {SERIES[seriesSlug].setLabel(entry.number)}
                  </span>
                  <span className="mt-3 text-xs text-ink-subtle">
                    {entry.locked ? "Upgrade to open" : `${entry.done} of ${entry.total} done`}
                  </span>
                  <span
                    aria-hidden
                    className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-alt"
                  >
                    <span
                      className="block h-1 rounded-full bg-brand-blue"
                      style={{
                        width: `${entry.total ? Math.round((entry.done / entry.total) * 100) : 0}%`,
                      }}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {level === "tests" && (
        <ul className="mx-auto max-w-4xl space-y-px bg-rule">
          {visible.map((test) => {
            const alwaysOpen = test.skill === "WRITING" || test.skill === "SPEAKING";
            const locked =
              !alwaysOpen && ((test.isPremium && !hasPremium) || !opensTest(test));
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
        )}

        {/* The upgrade band earns its place at the end rather than nagging from
            a modal or a sticky bar. */}
        {level === "tests" && !hasPremium && visible.some((test) => test.isPremium) && (
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
              href="https://t.me/DavronbekNabiev"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-3 rounded-[10px] bg-brand-red-cta px-6 py-3.5 text-sm font-bold text-white transition hover:bg-brand-red-dark"
            >
              Ask for premium access
              <span aria-hidden>→</span>
            </a>
          </div>
        )}

        {((level === "tests" && visible.length === 0) ||
          (level === "sets" && sets.length === 0) ||
          (level === "categories" && tests.length === 0)) && (
          <p className="mx-auto max-w-4xl bg-white p-12 text-center text-sm text-ink-subtle">
            {seriesSlug
              ? `No ${SERIES[seriesSlug].name.toLowerCase()} are published for ${active?.name.toLowerCase()} yet.`
              : active
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
