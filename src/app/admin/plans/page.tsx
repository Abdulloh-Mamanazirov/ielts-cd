import { AdminPage } from "@/components/admin/AdminPage";
import { PlansEditor } from "@/components/admin/PlansEditor";
import { prisma } from "@/lib/db";
import { loadPlans } from "@/lib/plans-store";

export const metadata = { title: "Plans · Admin" };
export const dynamic = "force-dynamic";

/**
 * What each subscription costs, promises and opens.
 *
 * The access pickers are built from the material that actually exists, so the
 * instructor ticks real volumes and books rather than typing numbers that may
 * not have been imported yet.
 */
export default async function PlansAdminPage() {
  const [plans, sets] = await Promise.all([
    loadPlans(),
    prisma.test.findMany({
      where: { status: "PUBLISHED", seriesNumber: { not: null } },
      select: { series: true, seriesNumber: true },
      distinct: ["series", "seriesNumber"],
      orderBy: [{ series: "asc" }, { seriesNumber: "asc" }],
    }),
  ]);

  const seriesNumbers = {
    REAL_EXAM: sets.filter((s) => s.series === "REAL_EXAM").map((s) => s.seriesNumber!),
    CAMBRIDGE: sets.filter((s) => s.series === "CAMBRIDGE").map((s) => s.seriesNumber!),
  };

  return (
    <AdminPage
      eyebrow="PLANS"
      title="Subscriptions"
      subtitle="Prices, wording, which material each plan opens, and how many full mocks it allows. Saved changes appear on the pricing page immediately."
    >
      <PlansEditor initial={plans} seriesNumbers={seriesNumbers} />
    </AdminPage>
  );
}
