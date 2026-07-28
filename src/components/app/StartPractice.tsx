import Link from "next/link";

import { SkillIcon } from "@/components/SkillIcon";
import { SKILLS } from "@/lib/skills";
import { cn } from "@/lib/utils";

/**
 * A row of ordinary buttons, not a feature grid.
 *
 * The dashboard exists to show a student their results; getting into a test is
 * a one-line errand they already know how to do, so it takes a strip rather
 * than four large cards competing with the band history below.
 */
export function StartPractice({
  counts,
  fullMockReady,
}: {
  counts: Record<string, number>;
  fullMockReady: boolean;
}) {
  return (
    <section className="bg-white px-6 py-5 lg:px-8">
      <h2 className="text-[10px] font-bold tracking-[0.22em] text-ink-subtle">START PRACTISING</h2>

      <ul className="mt-3 flex flex-wrap gap-2">
        {SKILLS.map((skill) => {
          const count = counts[skill.slug] ?? 0;
          const empty = count === 0;

          return (
            <li key={skill.slug}>
              <Link
                href={`/tests?skill=${skill.slug}`}
                aria-disabled={empty || undefined}
                className={cn(
                  "group inline-flex items-center gap-2.5 rounded-[9px] px-3.5 py-2.5 text-[13px] font-bold transition",
                  empty
                    ? "cursor-default bg-surface-alt text-ink-subtle"
                    : "bg-surface-alt text-ink hover:bg-ink hover:text-white",
                )}
              >
                <SkillIcon
                  skill={skill.slug}
                  size={16}
                  className={cn(
                    "flex-none transition",
                    empty ? "text-ink-faint" : "text-brand-blue group-hover:text-white",
                  )}
                />
                {skill.name}
                <span
                  className={cn(
                    "text-[11px] font-bold tabular-nums transition",
                    empty ? "text-ink-faint" : "text-ink-subtle group-hover:text-white/60",
                  )}
                >
                  {empty ? "soon" : count}
                </span>
              </Link>
            </li>
          );
        })}

        <li>
          <Link
            href="/tests?skill=full"
            className={cn(
              "group inline-flex items-center gap-2.5 rounded-[9px] px-3.5 py-2.5 text-[13px] font-bold transition",
              fullMockReady
                ? "bg-ink text-white hover:bg-brand-red-cta"
                : "cursor-default bg-surface-alt text-ink-subtle",
            )}
          >
            <SkillIcon
              skill="full"
              size={16}
              className={cn("flex-none", fullMockReady ? "text-brand-red" : "text-ink-faint")}
            />
            Full mock
            {!fullMockReady && (
              <span className="text-[11px] font-bold text-ink-faint">soon</span>
            )}
          </Link>
        </li>
      </ul>
    </section>
  );
}
