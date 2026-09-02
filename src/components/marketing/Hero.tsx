import Link from "next/link";

import { ArcMark, HeroPortrait, Marquee } from "./Brand";
import { site } from "@/content/site";

const TICKER = [
  "COMPUTER-DELIVERED MOCK TESTS",
  "REAL EXAM TIMING",
  "EXAMINER-STYLE WRITING FEEDBACK",
  "BAND 7–9",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-surface-alt">
      <div aria-hidden className="om-grid-lines absolute inset-0" />
      {/* The editorial red rule that anchors the left edge of the grid. */}
      <div aria-hidden className="absolute bottom-0 left-6 top-0 w-0.5 bg-brand-red lg:left-14" />
      <div
        aria-hidden
        className="absolute -right-36 -top-44 hidden h-[640px] w-[640px] animate-[var(--animate-spin-slow)] rounded-full border-[1.5px] border-brand-blue/20 lg:block"
      />

      <div className="relative mx-auto flex max-w-[1440px] flex-col gap-10 px-8 pb-14 pt-12 lg:flex-row lg:items-start lg:gap-6 lg:px-14 lg:pb-16 lg:pl-[92px] lg:pt-[60px]">
        <div className="min-w-0 flex-1 lg:max-w-[760px]">
          <div className="flex animate-[var(--animate-rise)] items-center gap-3.5">
            <ArcMark size={20} />
            <span className="text-[11.5px] font-bold tracking-[0.24em] text-ink-soft">
              {site.instructor.role.toUpperCase()}
            </span>
            <span aria-hidden className="h-px min-w-6 flex-1 bg-ink-faint" />
          </div>

          <h1 className="mt-5 animate-[var(--animate-rise)] font-display text-[clamp(3rem,9vw,6.5rem)] leading-[0.9] tracking-[-0.035em] text-balance [animation-delay:60ms]">
            Davronbek
            <br />
            <span className="text-brand-red">Nabiev</span>
          </h1>

          <p className="mt-6 max-w-[30ch] animate-[var(--animate-rise)] text-lg font-medium leading-[1.35] text-ink-muted text-pretty [animation-delay:120ms] lg:text-[26px]">
            Helping students achieve{" "}
            <span className="font-bold text-ink shadow-[inset_0_-10px_0_rgba(1,84,248,.18)]">
              IELTS Band 7–9
            </span>
          </p>

          <div className="mt-9 flex animate-[var(--animate-rise)] flex-wrap gap-3.5 [animation-delay:180ms]">
            {/* Practice leads, in the red primary style: the site is about
                everyday practice first and the mock second. Each label keeps
                the destination it already had. */}
            <Link
              href="/signup"
              className="inline-flex items-center gap-3 rounded-[10px] bg-brand-red-cta px-7 py-4 text-lg font-bold text-white shadow-[0_16px_30px_-12px_rgba(225,0,70,.65),0_2px_0_rgba(11,17,32,.06)] transition hover:bg-brand-red-dark"
            >
              {site.hero.secondaryCta}
              <Arrow />
            </Link>
            <Link
              href="/tests"
              className="inline-flex items-center gap-2.5 rounded-[10px] bg-white px-7 py-4 text-lg font-bold text-ink shadow-[0_1px_0_rgba(11,17,32,.14),0_10px_24px_-16px_rgba(11,17,32,.6)] transition hover:-translate-y-0.5"
            >
              {site.hero.primaryCta}
            </Link>
          </div>

          <dl className="mt-10 flex max-w-[740px] animate-[var(--animate-rise)] border-t-[1.5px] border-rule-strong [animation-delay:240ms] lg:mt-14">
            {site.stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`min-w-0 flex-1 pt-5 ${
                  index === 0 ? "pr-5 lg:pr-7" : "border-l border-rule pl-5 lg:px-7"
                } ${index === site.stats.length - 1 ? "lg:pr-0" : ""}`}
              >
                <dt
                  className={`text-[10px] font-bold tracking-[0.2em] ${
                    index === 1 ? "text-brand-red-cta" : "text-ink-subtle"
                  }`}
                >
                  {stat.eyebrow}
                </dt>
                <dd>
                  <span
                    className={`mt-3.5 block font-display text-[clamp(2rem,6vw,3.25rem)] leading-none tracking-[-0.03em] ${
                      index === 1 ? "text-brand-red" : "text-ink"
                    }`}
                  >
                    {stat.value}
                  </span>
                  <span className="mt-2 block text-sm font-medium text-ink-soft text-pretty">
                    {stat.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="w-full flex-none lg:w-[496px] lg:pt-9">
          <HeroPortrait />
        </div>
      </div>

      <Marquee items={TICKER} />
    </section>
  );
}

function Arrow() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
