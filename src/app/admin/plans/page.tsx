import { AdminPage } from "@/components/admin/AdminPage";
import { PlansEditor } from "@/components/admin/PlansEditor";
import { prisma } from "@/lib/db";
import { loadPlans } from "@/lib/plans-store";
import { naturalCompare } from "@/lib/utils";

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
  const [plans, sets, skillTestRows] = await Promise.all([
    loadPlans(),
    prisma.test.findMany({
      where: { status: "PUBLISHED", seriesNumber: { not: null } },
      select: { series: true, seriesNumber: true },
      distinct: ["series", "seriesNumber"],
      orderBy: [{ series: "asc" }, { seriesNumber: "asc" }],
    }),
    // Writing and speaking belong to no numbered set, so they are listed
    // individually and chosen by slug.
    prisma.test.findMany({
      where: { status: "PUBLISHED", skill: { in: ["WRITING", "SPEAKING"] } },
      select: { slug: true, title: true, skill: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const seriesNumbers = {
    REAL_EXAM: sets.filter((s) => s.series === "REAL_EXAM").map((s) => s.seriesNumber!),
    CAMBRIDGE: sets.filter((s) => s.series === "CAMBRIDGE").map((s) => s.seriesNumber!),
  };

  // The database can only sort titles lexicographically, which files "Mock 10"
  // between "Mock 1" and "Mock 2". Re-sort so the buttons read in order.
  const bySkill = (skill: "WRITING" | "SPEAKING") =>
    skillTestRows
      .filter((test) => test.skill === skill)
      .map(({ slug, title }) => ({ slug, title }))
      .sort((a, b) => naturalCompare(a.title, b.title));

  const skillTests = { WRITING: bySkill("WRITING"), SPEAKING: bySkill("SPEAKING") };

  return (
    <AdminPage
      eyebrow="PLANS"
      title="Subscriptions"
      subtitle="Prices, wording, which material each plan opens, and how many full mocks it allows. Saved changes appear on the pricing page immediately."
    >
      <PlansEditor initial={plans} seriesNumbers={seriesNumbers} skillTests={skillTests} />
    </AdminPage>
  );
}
