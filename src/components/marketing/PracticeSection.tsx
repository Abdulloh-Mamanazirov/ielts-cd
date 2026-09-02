import Link from "next/link";

import { Marquee } from "./Brand";
import { SectionHeading } from "./SectionHeading";
import { site } from "@/content/site";

/** Line icons rather than emoji — one weight, one style, all 24px. */
const ICONS: Record<string, React.ReactNode> = {
  listening: (
    <>
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <path d="M21 14v3a3 3 0 0 1-3 3h-1v-6h1a3 3 0 0 1 3 3Z" />
      <path d="M3 14v3a3 3 0 0 0 3 3h1v-6H6a3 3 0 0 0-3 3Z" />
    </>
  ),
  reading: (
    <>
      <path d="M12 6.5S9.5 4 3 4v14c6.5 0 9 2.5 9 2.5s2.5-2.5 9-2.5V4c-6.5 0-9 2.5-9 2.5Z" />
      <path d="M12 6.5v14" />
    </>
  ),
  writing: (
    <>
      <path d="M15 4.5 19.5 9 8 20.5l-5 1 1-5L15 4.5Z" />
      <path d="m13 6.5 4.5 4.5" />
    </>
  ),
  speaking: (
    <>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5v4" />
    </>
  ),
};

export function PracticeSection({ counts }: { counts: Record<string, number> }) {
  return (
    <section id="practice" className="scroll-mt-24 bg-surface-alt py-16 lg:py-24">
      <div className="mx-auto max-w-[1440px] px-8 lg:px-14">
        <SectionHeading
          eyebrow="PRACTICE TESTS"
          title={
            <>
              One skill at a time.
              <br />
              Or the whole exam.
            </>
          }
        />

        <ul className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4">
          {site.skills.map((skill) => {
            const count = counts[skill.slug] ?? 0;

            return (
              <li key={skill.slug}>
                <Link
                  // Straight to that skill's shelf. /tests reads ?skill= and
                  // site.skills[].slug is the same set as lib/skills SKILL_SLUGS.
                  href={`/tests?skill=${skill.slug}`}
                  className="group flex h-full flex-col bg-white p-7 transition hover:bg-brand-red-cta"
                >
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                    className="text-brand-blue transition group-hover:text-white"
                  >
                    {ICONS[skill.slug]}
                  </svg>

                  <h3 className="mt-6 font-display text-2xl leading-none tracking-[-0.02em] text-ink transition group-hover:text-white">
                    {skill.name}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted transition group-hover:text-white/80">
                    {skill.blurb}
                  </p>

                  <span className="mt-7 flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-ink-subtle transition group-hover:text-white">
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

        {/* Full-bleed dark break — the design alternates grid-locked sections
            with one that escapes the frame, so the page has a change of pace. */}
        <div className="relative mt-px overflow-hidden bg-ink">
          <div
            aria-hidden
            className="absolute -right-24 -top-24 h-[380px] w-[380px] animate-[var(--animate-spin-slow)] rounded-full border border-brand-blue/25"
          />
          <div className="relative grid gap-8 p-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:p-14">
            <div>
              <SectionHeading
                eyebrow="FULL MOCK"
                title={
                  <>
                    Sit the real thing
                    <br />
                    before you sit it.
                  </>
                }
                subtitle={site.practice.mockBody}
                onDark
                className="mb-8"
              />
              <Link
                href="/tests"
                className="inline-flex items-center gap-3 rounded-[10px] bg-brand-red-cta px-7 py-4 text-lg font-bold text-white shadow-[0_16px_30px_-12px_rgba(225,0,70,.65)] transition hover:bg-brand-red-dark"
              >
                {site.practice.mockCta}
                <span aria-hidden>→</span>
              </Link>
            </div>

            <ul className="space-y-px bg-white/10">
              {site.practice.mockPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-center gap-3.5 bg-ink px-5 py-4 text-sm font-medium text-white/85"
                >
                  <span aria-hidden className="font-bold text-brand-red">
                    ◆
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <Marquee
            items={["INSTANT BAND SCORE", "40 QUESTIONS", "NO PAUSING", "REAL CD INTERFACE"]}
            height={44}
            className="border-t border-white/10"
          />
        </div>
      </div>
    </section>
  );
}
