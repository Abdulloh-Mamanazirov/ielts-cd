import { AdminPage, EmptyState } from "@/components/admin/AdminPage";
import { PremiumToggle } from "@/components/admin/PremiumToggle";
import { prisma } from "@/lib/db";

export default async function StudentsPage() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      fullName: true,
      email: true,
      isPremium: true,
      premiumNote: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { attempts: true } },
    },
  });

  return (
    <AdminPage
      eyebrow="STUDENTS"
      title={`${students.length} student${students.length === 1 ? "" : "s"}.`}
      subtitle="Premium opens every paid test. Granting it here takes effect on the student's next request — there is no cached copy to wait for."
    >
      {students.length === 0 ? (
        <EmptyState>Nobody has signed up yet.</EmptyState>
      ) : (
        <ul className="space-y-px bg-rule">
          {students.map((student) => (
            <li
              key={student.id}
              className="flex flex-wrap items-center gap-4 bg-white px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{student.fullName}</p>
                <p className="mt-0.5 truncate text-xs text-ink-subtle">
                  {student.email} · joined {student.createdAt.toLocaleDateString()}
                  {student.lastLoginAt
                    ? ` · last seen ${student.lastLoginAt.toLocaleDateString()}`
                    : " · never signed in"}
                </p>
                {student.premiumNote && (
                  <p className="mt-1 text-xs italic text-ink-subtle">{student.premiumNote}</p>
                )}
              </div>

              <span className="text-xs tabular-nums text-ink-subtle">
                {student._count.attempts} attempt{student._count.attempts === 1 ? "" : "s"}
              </span>

              <PremiumToggle
                userId={student.id}
                isPremium={student.isPremium}
                name={student.fullName}
              />
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
