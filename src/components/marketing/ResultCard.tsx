import Image from "next/image";

import { Lightbox } from "./Lightbox";
import { cn } from "@/lib/utils";

export type ShowcaseResult = {
  id: string;
  studentName: string;
  overallBand: number;
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  quoteEn: string | null;
  certificateUrl: string | null;
  testDate: Date | string | null;
};

/**
 * The certificate is tucked into the card at an angle behind a hard red block,
 * echoing the hero portrait treatment. On hover it straightens and lifts, which
 * is also the affordance that it opens.
 */
export function ResultCard({
  result,
  index,
  className,
}: {
  result: ShowcaseResult;
  index: number;
  className?: string;
}) {
  const skills = (
    [
      ["L", result.listening],
      ["R", result.reading],
      ["W", result.writing],
      ["S", result.speaking],
    ] as const
  ).filter(([, band]) => band !== null);

  const year = result.testDate ? new Date(result.testDate).getFullYear() : null;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden bg-surface-alt p-6 transition duration-300",
        "hover:-translate-y-1 hover:bg-white hover:shadow-[0_28px_50px_-24px_rgba(11,17,32,.35)]",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-brand-red transition-transform duration-300 group-hover:scale-x-100"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-ink">{result.studentName}</h3>
          {year && (
            <p className="mt-1 text-[10px] font-bold tracking-[0.2em] text-ink-subtle">{year}</p>
          )}
        </div>
        <span className="font-display text-[10px] tracking-[0.2em] text-brand-blue">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-[3.25rem] leading-none tracking-[-0.03em] text-brand-red">
            {result.overallBand.toFixed(1)}
          </p>
          <p className="mt-2 text-[10px] font-bold tracking-[0.2em] text-ink-subtle">
            OVERALL BAND
          </p>
        </div>

        {result.certificateUrl && (
          <Lightbox
            src={result.certificateUrl}
            alt={`IELTS Test Report Form for ${result.studentName}`}
            caption={`${result.studentName} — Band ${result.overallBand.toFixed(1)}`}
            className="flex-none"
          >
            <span className="relative block h-[86px] w-[64px]">
              <span
                aria-hidden
                className="absolute inset-0 rotate-[6deg] bg-brand-red transition-transform duration-300 group-hover:rotate-[9deg]"
              />
              <span className="absolute inset-0 block -rotate-[4deg] overflow-hidden bg-white p-[3px] shadow-md transition-transform duration-300 group-hover:rotate-0 group-hover:scale-110">
                <Image
                  src={result.certificateUrl}
                  alt=""
                  width={128}
                  height={172}
                  className="h-full w-full object-cover object-top"
                />
              </span>
              <span
                aria-hidden
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] text-white shadow"
              >
                ⤢
              </span>
            </span>
          </Lightbox>
        )}
      </div>

      <dl className="mt-5 flex border-t-2 border-brand-blue/25 pt-4 transition-colors duration-300 group-hover:border-brand-blue">
        {skills.map(([letter, band]) => (
          <div key={letter} className="flex-1">
            <dt className="text-[10px] font-bold text-brand-blue">{letter}</dt>
            <dd className="mt-1 text-base font-bold text-ink">{band!.toFixed(1)}</dd>
          </div>
        ))}
      </dl>

      {result.quoteEn && (
        <p className="mt-5 border-l-2 border-brand-red pl-3.5 text-sm leading-relaxed text-ink-muted">
          {result.quoteEn}
        </p>
      )}

      {result.certificateUrl && (
        <p className="mt-4 text-[10px] font-bold tracking-[0.18em] text-ink-subtle opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          CLICK THE SLIP TO ENLARGE
        </p>
      )}
    </article>
  );
}
