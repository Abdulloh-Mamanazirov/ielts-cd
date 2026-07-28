import Link from "next/link";

import { SkillIcon } from "@/components/SkillIcon";
import { SKILLS } from "@/lib/skills";
import { cn } from "@/lib/utils";

/**
 * The four skills are deliberately identical — no favourite, no upsell inside
 * them — so the full mock is the one loud thing on the page.
 */
export function StartPractice({ counts }: { counts: Record<string, number> }) {
  return (
    <section className="bg-white p-6 lg:p-8">
      <h2 className="text-[10px] font-bold tracking-[0.22em] text-ink-subtle">START PRACTISING</h2>

      <ul className="mt-5 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4">
        {SKILLS.map((skill) => {
          const count = counts[skill.slug] ?? 0;

          return (
            <li key={skill.slug}>
              <Link
                href={`/tests?skill=${skill.slug}`}
                className="group flex h-full flex-col bg-white p-5 transition hover:bg-brand-blue"
              >
                <SkillIcon
                  skill={skill.slug}
                  size={24}
                  className="text-brand-blue transition group-hover:text-white"
                />
                <h3 className="mt-4 font-display text-lg leading-none tracking-[-0.02em] text-ink transition group-hover:text-white">
                  {skill.name}
                </h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-ink-muted transition group-hover:text-white/80">
                  {skill.blurb}
                </p>
                <span className="mt-4 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.18em] text-ink-subtle transition group-hover:text-white">
                  {count > 0 ? `${count} TEST${count === 1 ? "" : "S"}` : "COMING SOON"}
                  <span aria-hidden className="transition group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <FullMockBanner />
    </section>
  );
}

/**
 * Not linked yet: a full mock composes one test per skill, and neither the
 * writing nor speaking player exists. Showing it disabled with the reason is
 * more honest than a button that leads nowhere.
 */
function FullMockBanner() {
  return (
    <div className="mt-px flex flex-wrap items-center gap-5 bg-ink p-6 lg:p-7">
      <SkillIcon skill="full" size={28} className="flex-none text-brand-red" />

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold tracking-[0.22em] text-brand-red">FULL MOCK</p>
        <h3 className="mt-1.5 font-display text-xl leading-tight tracking-[-0.02em] text-white">
          All four skills, one sitting.
        </h3>
        <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-white/60">
          Listening, reading and writing back to back under exam timing, with speaking optional.
        </p>
      </div>

      <span
        aria-disabled="true"
        className={cn(
          "flex-none cursor-not-allowed rounded-[10px] px-6 py-3.5 text-sm font-bold",
          "bg-white/10 text-white/50",
        )}
      >
        Coming soon
      </span>
    </div>
  );
}
