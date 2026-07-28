import { AdminPage, EmptyState } from "@/components/admin/AdminPage";
import { ImportTest } from "@/components/admin/ImportTest";
import { TestStatusControl } from "@/components/admin/TestStatusControl";
import { prisma } from "@/lib/db";
import { describeTest } from "@/lib/skills";
import { cn } from "@/lib/utils";

export default async function AdminTestsPage() {
  const tests = await prisma.test.findMany({
    orderBy: [{ skill: "asc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      skill: true,
      status: true,
      isPremium: true,
      totalQuestions: true,
      durationSeconds: true,
      audioSourceUrl: true,
      audioAsset: { select: { filename: true, durationSeconds: true } },
    },
  });

  return (
    <AdminPage
      eyebrow="TESTS"
      title={`${tests.length} test${tests.length === 1 ? "" : "s"}.`}
      subtitle="Imported JSON always lands as a draft. Publishing is the moment students can see it, so it is a separate, deliberate step."
    >
      <ImportTest />

      {tests.length === 0 ? (
        <EmptyState>Nothing imported yet.</EmptyState>
      ) : (
        <ul className="mt-6 space-y-px bg-rule">
          {tests.map((test) => {
            const needsAudio = test.skill === "LISTENING" && !test.audioAsset;

            return (
              <li key={test.id} className="flex flex-wrap items-center gap-4 bg-white px-5 py-4">
                <span
                  className={cn(
                    "w-20 shrink-0 text-[10px] font-bold tracking-[0.18em]",
                    test.status === "PUBLISHED" ? "text-brand-blue" : "text-ink-subtle",
                  )}
                >
                  {test.skill}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{test.title}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-subtle">
                    {describeTest(test.totalQuestions, test.durationSeconds)}
                    {test.isPremium && " · Premium"}
                    {test.audioAsset && ` · ${test.audioAsset.filename}`}
                  </p>
                  {needsAudio && (
                    <p className="mt-1 text-xs font-semibold text-brand-red-cta">
                      No audio uploaded — run{" "}
                      <code className="rounded bg-surface-alt px-1">
                        npm run audio:upload -- --test {test.slug} --from-source
                      </code>
                    </p>
                  )}
                </div>

                <TestStatusControl
                  testId={test.id}
                  status={test.status}
                  blocked={needsAudio}
                />
              </li>
            );
          })}
        </ul>
      )}
    </AdminPage>
  );
}
