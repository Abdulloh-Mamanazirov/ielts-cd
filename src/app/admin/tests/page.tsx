import Link from "next/link";

import { AdminPage, EmptyState } from "@/components/admin/AdminPage";
import { ImportTest } from "@/components/admin/ImportTest";
import { TestDetails } from "@/components/admin/TestDetails";
import { TestImageUpload } from "@/components/admin/TestImageUpload";
import { TestStatusControl } from "@/components/admin/TestStatusControl";
import { SkillIcon } from "@/components/SkillIcon";
import { prisma } from "@/lib/db";
import { describeTest, SKILLS } from "@/lib/skills";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tests" };

type Filter = "all" | "draft" | "published" | "archived" | "needs-work";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "needs-work", label: "Needs work" },
  { key: "draft", label: "Drafts" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
];

/** What is stopping this test being sat, if anything. */
function blockers(test: {
  skill: string;
  audioAssetId: string | null;
  content: unknown;
}): string[] {
  const found: string[] = [];
  if (test.skill === "LISTENING" && !test.audioAssetId) found.push("audio");

  const content = test.content as {
    tasks?: Array<{ number: number; imageUrl?: string }>;
    parts?: Array<{ groups: Array<{ id: string; type: string; imageUrl?: string }> }>;
  };

  // Academic Task 1 is a description of a visual; without it there is nothing
  // to write about. The same goes for a map-labelling group.
  for (const task of content.tasks ?? []) {
    if (task.number === 1 && !task.imageUrl) found.push("Task 1 image");
  }
  for (const part of content.parts ?? []) {
    for (const group of part.groups) {
      if (group.type === "map_labeling" && !group.imageUrl) found.push(`map image (${group.id})`);
    }
  }

  return found;
}

export default async function AdminTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; show?: string }>;
}) {
  const { skill, show } = await searchParams;
  const filter = (FILTERS.find((entry) => entry.key === show)?.key ?? "all") as Filter;
  const activeSkill = SKILLS.find((entry) => entry.slug === skill);

  const tests = await prisma.test.findMany({
    where: {
      ...(activeSkill ? { skill: activeSkill.db } : {}),
      ...(filter === "draft" ? { status: "DRAFT" as const } : {}),
      ...(filter === "published" ? { status: "PUBLISHED" as const } : {}),
      ...(filter === "archived" ? { status: "ARCHIVED" as const } : {}),
    },
    orderBy: [{ skill: "asc" }, { status: "asc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      skill: true,
      status: true,
      isPremium: true,
      totalQuestions: true,
      durationSeconds: true,
      updatedAt: true,
      audioAssetId: true,
      content: true,
      audioAsset: { select: { filename: true } },
      _count: { select: { attempts: true } },
    },
  });

  const withBlockers = tests.map((test) => ({ ...test, blockers: blockers(test) }));
  const visible =
    filter === "needs-work"
      ? withBlockers.filter((test) => test.blockers.length > 0 || test.status === "DRAFT")
      : withBlockers;

  // Grouped by skill so a library of hundreds stays navigable.
  const grouped = SKILLS.map((entry) => ({
    skill: entry,
    tests: visible.filter((test) => test.skill === entry.db),
  })).filter((group) => group.tests.length > 0);

  const needingWork = withBlockers.filter((test) => test.blockers.length > 0).length;

  return (
    <AdminPage
      eyebrow="TESTS"
      title={`${tests.length} test${tests.length === 1 ? "" : "s"}.`}
      subtitle={
        needingWork > 0
          ? `${needingWork} cannot be sat yet — they are missing audio or artwork.`
          : "Import as many as you like; everything arrives as a draft, and nothing reaches students until you publish it."
      }
    >
      <ImportTest />

      <div className="mt-6 flex flex-wrap gap-4">
        <Chips
          label="Skill"
          items={[
            { key: "", label: "All skills", href: linkTo(undefined, filter) },
            ...SKILLS.map((entry) => ({
              key: entry.slug,
              label: entry.name,
              href: linkTo(entry.slug, filter),
            })),
          ]}
          activeKey={activeSkill?.slug ?? ""}
        />

        <Chips
          label="Show"
          items={FILTERS.map((entry) => ({
            key: entry.key,
            label: entry.label,
            href: linkTo(activeSkill?.slug, entry.key),
          }))}
          activeKey={filter}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState>Nothing here. Try a different filter, or import a test.</EmptyState>
      ) : (
        <div className="mt-4 space-y-6">
          {grouped.map((group) => (
            <section key={group.skill.slug}>
              <h2 className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-ink-subtle">
                <SkillIcon skill={group.skill.slug} size={14} className="text-brand-blue" />
                {group.skill.name.toUpperCase()} · {group.tests.length}
              </h2>

              <ul className="mt-2 space-y-px bg-rule">
                {group.tests.map((test) => (
                  <li key={test.id} className="bg-white px-5 py-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{test.title}</p>
                        <p className="mt-0.5 truncate text-xs text-ink-subtle">
                          {describeTest(test.totalQuestions, test.durationSeconds)}
                          {test.isPremium ? " · Premium" : " · Free"}
                          {test._count.attempts > 0 && ` · ${test._count.attempts} sat`}
                          {test.audioAsset && ` · ${test.audioAsset.filename}`}
                        </p>
                      </div>

                      <Link
                        href={`/tests/${test.slug}`}
                        className="rounded-[9px] bg-surface-alt px-3 py-2 text-[12px] font-bold text-ink-muted transition hover:bg-ink hover:text-white"
                      >
                        Preview →
                      </Link>

                      <TestDetails
                        testId={test.id}
                        title={test.title}
                        isPremium={test.isPremium}
                        durationSeconds={test.durationSeconds}
                      />

                      <TestStatusControl
                        testId={test.id}
                        status={test.status}
                        blocked={test.blockers.length > 0}
                      />
                    </div>

                    {test.blockers.length > 0 && (
                      <p className="mt-2 text-xs font-semibold text-brand-red-cta">
                        Cannot be published — missing {test.blockers.join(", ")}.
                      </p>
                    )}

                    {test.skill === "LISTENING" && !test.audioAssetId && (
                      <p className="mt-1.5 text-xs text-ink-subtle">
                        Upload it with{" "}
                        <code className="rounded bg-surface-alt px-1">
                          npm run audio:upload -- --test {test.slug} --from-source
                        </code>
                      </p>
                    )}

                    <ImageSlots testId={test.id} slug={test.slug} content={test.content} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AdminPage>
  );
}

function linkTo(skill: string | undefined, show: Filter): string {
  const params = new URLSearchParams();
  if (skill) params.set("skill", skill);
  if (show !== "all") params.set("show", show);
  const query = params.toString();
  return query ? `/admin/tests?${query}` : "/admin/tests";
}

function Chips({
  label,
  items,
  activeKey,
}: {
  label: string;
  items: Array<{ key: string; label: string; href: string }>;
  activeKey: string;
}) {
  return (
    <div>
      <p className="text-[9.5px] font-bold tracking-[0.18em] text-ink-subtle">
        {label.toUpperCase()}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.key === activeKey ? "page" : undefined}
            className={cn(
              "rounded-[9px] px-3 py-1.5 text-[12px] font-bold transition",
              item.key === activeKey
                ? "bg-ink text-white"
                : "bg-white text-ink-muted hover:bg-ink/10",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Every place this test wants a picture, with an upload for each. */
function ImageSlots({
  testId,
  slug,
  content,
}: {
  testId: string;
  slug: string;
  content: unknown;
}) {
  const parsed = content as {
    tasks?: Array<{ number: number; imageUrl?: string }>;
    parts?: Array<{ groups: Array<{ id: string; type: string; imageUrl?: string }> }>;
  };

  const slots: Array<{ target: number | string; label: string; url?: string }> = [];

  for (const task of parsed.tasks ?? []) {
    // Only Task 1 is a description of a visual; Task 2 is an essay prompt.
    if (task.number === 1) {
      slots.push({ target: 1, label: "Task 1", url: task.imageUrl });
    }
  }
  for (const part of parsed.parts ?? []) {
    for (const group of part.groups) {
      if (group.type === "map_labeling") {
        slots.push({ target: group.id, label: "map", url: group.imageUrl });
      }
    }
  }

  if (slots.length === 0) return null;

  return (
    <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2">
      {slots.map((slot) => (
        <TestImageUpload
          key={String(slot.target)}
          testId={testId}
          target={slot.target}
          label={slot.label}
          currentUrl={slot.url}
          slug={slug}
        />
      ))}
    </div>
  );
}
