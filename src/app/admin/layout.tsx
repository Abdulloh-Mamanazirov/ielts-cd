import Link from "next/link";

import { LogoMark } from "@/components/marketing/Brand";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const metadata = { title: "Admin" };

/**
 * The instructor's side of the product. Deliberately plainer than the student
 * app — this is a work queue, so counts and rows matter more than typography.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  const [awaitingMarking, pendingReviews] = await Promise.all([
    prisma.attempt.count({
      where: {
        status: "SUBMITTED",
        band: null,
        reviewRequested: true,
        test: { skill: { in: ["WRITING", "SPEAKING"] } },
      },
    }),
    prisma.answerReview.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col bg-ink text-white lg:sticky lg:top-0 lg:h-dvh lg:w-[236px]">
        <div className="px-5 py-5">
          <Link href="/admin" className="flex items-center gap-3">
            <LogoMark size={28} />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[13px]">DAVRONBEK</span>
              <span className="mt-1 text-[8.5px] font-bold tracking-[0.28em] text-brand-red">
                INSTRUCTOR
              </span>
            </span>
          </Link>
        </div>

        <AdminNav awaitingMarking={awaitingMarking} pendingReviews={pendingReviews} />

        <div className="mt-auto hidden border-t border-white/10 px-5 py-4 lg:block">
          <p className="truncate text-sm font-bold">{user.fullName}</p>
          <Link
            href="/dashboard"
            className="mt-3 inline-block rounded-lg bg-white/10 px-3 py-2 text-xs font-bold transition hover:bg-white hover:text-ink"
          >
            Student view →
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1 bg-surface-alt">{children}</div>
    </div>
  );
}
