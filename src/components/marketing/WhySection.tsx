import Link from "next/link";

import { SectionHeading } from "./SectionHeading";
import { site } from "@/content/site";

export function WhySection() {
  return (
    <section id="about" className="relative scroll-mt-24 overflow-hidden bg-white py-16 lg:py-24">
      <div aria-hidden className="absolute bottom-0 left-6 top-0 w-0.5 bg-brand-blue lg:left-14" />

      <div className="relative mx-auto grid max-w-[1440px] gap-12 px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-20 lg:px-14 lg:pl-[92px]">
        <div>
          <SectionHeading
            eyebrow="ABOUT ME"
            title={
              <>
                Why learn
                <br />
                with me?
              </>
            }
            subtitle={site.why.body}
          />

          <Link
            href="/signup"
            className="inline-flex items-center gap-2.5 rounded-[10px] bg-white px-7 py-4 text-lg font-bold text-ink shadow-[0_1px_0_rgba(11,17,32,.14),0_10px_24px_-16px_rgba(11,17,32,.6)] transition hover:-translate-y-0.5"
          >
            Start practising free
            <span aria-hidden>→</span>
          </Link>
        </div>

        <ol className="self-center">
          {site.why.points.map((point, index) => (
            <li
              key={point}
              className="flex items-baseline gap-5 border-b border-rule py-5 first:border-t"
            >
              <span className="font-display text-sm tabular-nums text-brand-red">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-base font-medium leading-snug text-ink text-pretty">
                {point}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
