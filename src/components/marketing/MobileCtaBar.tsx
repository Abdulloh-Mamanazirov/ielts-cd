import Link from "next/link";

import { site } from "@/content/site";

/**
 * Pinned primary action on phones. Practice fills the bar and the mock test
 * sits beside it as the icon button, matching the hero, where practice is now
 * the primary call to action. Hidden from large screens, where the hero buttons
 * are always reachable.
 */
export function MobileCtaBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 bg-white px-4 pb-5 pt-3.5 shadow-[0_-14px_30px_-18px_rgba(11,17,32,.4)] lg:hidden">
      <Link
        href="/signup"
        className="inline-flex h-[54px] min-w-0 flex-1 items-center justify-center gap-2.5 rounded-[10px] bg-brand-red-cta px-4 text-[17px] font-bold text-white shadow-[0_14px_24px_-12px_rgba(225,0,70,.7)]"
      >
        {site.hero.secondaryCta}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="flex-none"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </Link>

      <Link
        href="/tests"
        aria-label={site.hero.primaryCta}
        className="inline-flex h-[54px] w-[54px] flex-none items-center justify-center rounded-[10px] bg-surface-alt text-brand-blue shadow-[inset_0_0_0_1.5px_rgba(1,84,248,.25)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="m7 4 13 8-13 8Z" />
        </svg>
      </Link>
    </div>
  );
}
