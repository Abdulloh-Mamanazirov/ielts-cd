import Link from "next/link";

import { AdminPage } from "@/components/admin/AdminPage";
import { prisma } from "@/lib/db";

export default async function AdminOverviewPage() {
  const [awaitingMarking, pendingReviews, students, premium, published, drafts, mocks] =
    await Promise.all([
      prisma.attempt.count({
        where: {
          status: "SUBMITTED",
          band: null,
          reviewRequested: true,
          test: { skill: { in: ["WRITING", "SPEAKING"] } },
        },
      }),
      prisma.answerReview.count({ where: { status: "PENDING" } }),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { isPremium: true, role: "STUDENT" } }),
      prisma.test.count({ where: { status: "PUBLISHED" } }),
      prisma.test.count({ where: { status: "DRAFT" } }),
      prisma.fullMock.count(),
    ]);

  return (
    <AdminPage
      eyebrow="OVERVIEW"
      title="What needs you."
      subtitle="Anything with a number beside it is waiting on a person, not on the system."
    >
      <div className="grid gap-px bg-rule sm:grid-cols-2">
        <Queue
          href="/admin/marking"
          label="Awaiting marking"
          count={awaitingMarking}
          hint="Writing and speaking a student has finished but nobody has given a band."
        />
        <Queue
          href="/admin/reviews"
          label="Answer reviews"
          count={pendingReviews}
          hint="Typed answers the grader rejected that may be legitimate variants."
        />
      </div>

      <div className="mt-px grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students" value={students} href="/admin/students" />
        <Stat label="Premium" value={premium} href="/admin/students" />
        <Stat label="Published tests" value={published} href="/admin/tests" />
        <Stat label="Drafts" value={drafts} href="/admin/tests" />
      </div>

      <p className="mt-6 text-xs text-ink-subtle">
        {mocks} full mock{mocks === 1 ? "" : "s"} started to date.
      </p>
    </AdminPage>
  );
}

function Queue({
  href,
  label,
  count,
  hint,
}: {
  href: string;
  label: string;
  count: number;
  hint: string;
}) {
  return (
    <Link href={href} className="group bg-white p-6 transition hover:bg-surface-muted">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-ink-subtle">
          {label.toUpperCase()}
        </p>
        <span
          className={
            count > 0
              ? "font-display text-3xl leading-none text-brand-red-cta"
              : "font-display text-3xl leading-none text-ink-faint"
          }
        >
          {count}
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">{hint}</p>
      <span className="mt-3 inline-block text-[11px] font-bold tracking-[0.14em] text-brand-blue">
        OPEN →
      </span>
    </Link>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="bg-white p-5 transition hover:bg-surface-muted">
      <p className="text-[9.5px] font-bold tracking-[0.18em] text-ink-subtle">
        {label.toUpperCase()}
      </p>
      <p className="mt-1.5 font-display text-2xl leading-none text-ink">{value}</p>
    </Link>
  );
}
