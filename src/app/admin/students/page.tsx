import Link from "next/link";

import { AdminPage, EmptyState } from "@/components/admin/AdminPage";
import { StudentRow, type StudentRowData } from "@/components/admin/StudentRow";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Students · Admin" };
export const dynamic = "force-dynamic";

type Filters = {
  q?: string;
  plan?: string;
  student?: string;
  source?: string;
  mocks?: string;
};

const PLAN_FILTERS = [
  { value: "", label: "All plans" },
  { value: "FREE", label: "Free" },
  { value: "STUDENT", label: "Student" },
  { value: "PREMIUM", label: "Premium" },
  { value: "LAPSED", label: "Lapsed" },
];

const STUDENT_FILTERS = [
  { value: "", label: "Everyone" },
  { value: "yes", label: "His students" },
  { value: "no", label: "Not his students" },
];

const SOURCE_FILTERS = [
  { value: "", label: "Any sign-up" },
  { value: "telegram", label: "Telegram" },
  { value: "email", label: "Email" },
];

const MOCK_FILTERS = [
  { value: "", label: "Any mocks" },
  { value: "unlimited", label: "Unlimited unlocked" },
  { value: "used", label: "Has sat one" },
  { value: "none", label: "Never sat one" },
];

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const filters = await searchParams;
  const { q, plan, student, source, mocks } = filters;

  const where: Prisma.UserWhereInput = { role: "STUDENT" };

  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { fullName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
      { telegramUsername: { contains: term, mode: "insensitive" } },
    ];
  }

  // "Lapsed" is not a plan but a state: a paid plan whose end date has passed.
  if (plan === "LAPSED") {
    where.plan = { not: "FREE" };
    where.planExpiresAt = { lt: new Date() };
  } else if (plan === "FREE" || plan === "STUDENT" || plan === "PREMIUM") {
    where.plan = plan;
  }

  if (student === "yes") where.isStudent = true;
  if (student === "no") where.isStudent = false;

  if (source === "telegram") where.telegramId = { not: null };
  if (source === "email") where.telegramId = null;

  if (mocks === "unlimited") where.unlimitedMocks = true;
  if (mocks === "used") where.fullMocks = { some: {} };
  if (mocks === "none") where.fullMocks = { none: {} };

  const students = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 300,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      telegramUsername: true,
      isStudent: true,
      plan: true,
      planExpiresAt: true,
      unlimitedMocks: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { attempts: true, fullMocks: true } },
    },
  });

  const rows: StudentRowData[] = students.map((entry) => ({
    id: entry.id,
    fullName: entry.fullName,
    email: entry.email,
    phone: entry.phone,
    telegramUsername: entry.telegramUsername,
    isStudent: entry.isStudent,
    plan: entry.plan,
    planExpiresAt: entry.planExpiresAt ? entry.planExpiresAt.toISOString() : null,
    unlimitedMocks: entry.unlimitedMocks,
    attempts: entry._count.attempts,
    mocks: entry._count.fullMocks,
    joined: entry.createdAt.toLocaleDateString(),
    lastSeen: entry.lastLoginAt ? entry.lastLoginAt.toLocaleDateString() : null,
  }));

  return (
    <AdminPage
      eyebrow="STUDENTS"
      title={`${rows.length} student${rows.length === 1 ? "" : "s"}.`}
      subtitle="Edit a student to change their name, phone, plan and mock allowance. Changes take effect on their next request."
    >
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name, email, phone or @username"
          className="min-w-[240px] flex-1 rounded-[9px] bg-white px-3.5 py-2.5 text-[13px] text-ink shadow-[0_1px_2px_rgba(11,17,32,.08)] outline-none focus:shadow-[inset_0_0_0_2px_#0154f8]"
        />
        {/* Searching keeps whatever chips are already on. */}
        {plan && <input type="hidden" name="plan" value={plan} />}
        {student && <input type="hidden" name="student" value={student} />}
        {source && <input type="hidden" name="source" value={source} />}
        {mocks && <input type="hidden" name="mocks" value={mocks} />}
        <button
          type="submit"
          className="rounded-[9px] bg-ink px-4 py-2.5 text-[12px] font-bold text-white transition hover:bg-ink/90"
        >
          Search
        </button>
      </form>

      <div className="mb-5 space-y-2">
        <FilterRow name="plan" options={PLAN_FILTERS} filters={filters} />
        <FilterRow name="student" options={STUDENT_FILTERS} filters={filters} />
        <FilterRow name="source" options={SOURCE_FILTERS} filters={filters} />
        <FilterRow name="mocks" options={MOCK_FILTERS} filters={filters} />
      </div>

      {rows.length === 0 ? (
        <EmptyState>No student matches these filters.</EmptyState>
      ) : (
        <ul className="space-y-px bg-rule">
          {rows.map((row) => (
            <StudentRow key={row.id} student={row} />
          ))}
        </ul>
      )}
    </AdminPage>
  );
}

/** One row of mutually exclusive filter chips, as links that keep the others. */
function FilterRow({
  name,
  options,
  filters,
}: {
  name: keyof Filters;
  options: Array<{ value: string; label: string }>;
  filters: Filters;
}) {
  const active = filters[name] ?? "";

  const hrefFor = (value: string) => {
    const params = new URLSearchParams();
    for (const [key, entry] of Object.entries(filters)) {
      if (entry && key !== name) params.set(key, entry);
    }
    if (value) params.set(name, value);
    const query = params.toString();
    return query ? `/admin/students?${query}` : "/admin/students";
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <Link
          key={option.value || "all"}
          href={hrefFor(option.value)}
          className={cn(
            "rounded-[7px] px-3 py-1.5 text-[11.5px] font-bold transition",
            active === option.value ? "bg-ink text-white" : "bg-white text-ink-muted hover:bg-ink/10",
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
