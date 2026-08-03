import Image from "next/image";

import { site } from "@/content/site";
import { publicAsset } from "@/lib/site-assets";
import { cn } from "@/lib/utils";

/**
 * The mark is two open arcs — red sweeping one way, blue the other — built from
 * rotated circles with two transparent borders. Pure CSS, so it stays crisp at
 * any size and needs no asset.
 */
export function ArcMark({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const outer = Math.max(3, Math.round(size * 0.15));
  const inset = Math.round(size * 0.26);

  return (
    <span
      aria-hidden
      className={cn("relative block flex-none", className)}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-0 rounded-full border-brand-red"
        style={{
          borderWidth: outer,
          borderRightColor: "transparent",
          borderBottomColor: "transparent",
          transform: "rotate(42deg)",
        }}
      />
      <span
        className="absolute rounded-full border-brand-blue"
        style={{
          inset,
          borderWidth: outer,
          borderLeftColor: "transparent",
          borderTopColor: "transparent",
          transform: "rotate(42deg)",
        }}
      />
    </span>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  // The uploaded brand mark (DN over an open book, IELTS beneath). It is square,
  // so it is sized by height and keeps its own width.
  return (
    <Image
      src="/logo.png"
      alt="DN IELTS — Davronbek Nabiev"
      width={1254}
      height={1254}
      priority
      className={cn("w-auto", compact ? "h-9" : "h-11", className)}
    />
  );
}

/** Scrolling strip of claims. Duplicated once so the loop is seamless. */
export function Marquee({
  items,
  className,
  height = 54,
}: {
  items: string[];
  className?: string;
  height?: number;
}) {
  const run = (copy: number) => (
    <span
      key={copy}
      className="inline-flex flex-none items-center gap-[26px] pr-[26px] text-xs font-bold tracking-[0.22em] text-white"
    >
      {items.map((item, index) => (
        <span key={item} className="inline-flex items-center gap-[26px]">
          <span>{item}</span>
          <span className={index % 2 === 0 ? "text-brand-red" : "text-brand-blue"}>◆</span>
        </span>
      ))}
    </span>
  );

  return (
    <div
      className={cn("flex items-center overflow-hidden bg-ink", className)}
      style={{ height }}
      aria-hidden
    >
      {/* w-max is what makes the percentage shift relate to the content rather
          than to the bar, which is the other half of the old stutter. */}
      <div className="flex w-max animate-[var(--animate-marquee)] whitespace-nowrap">
        {[0, 1, 2, 3].map(run)}
      </div>
    </div>
  );
}

/**
 * Hero portrait: a hard red block offset behind a white photo card, with the
 * logo tile and location pill floating off its edges.
 */
export function HeroPortrait() {
  const photo = publicAsset("instructor");

  return (
    <div className="relative mx-auto w-full max-w-[496px]">
      <div className="relative aspect-[392/498] w-full">
        <div
          aria-hidden
          className="absolute left-0 top-[6%] h-[94%] w-[88%] -rotate-[3.5deg] rounded-md bg-brand-red"
        />

        <div className="absolute right-0 top-0 h-full w-[88%] rounded-md bg-white p-3.5 shadow-[0_40px_70px_-34px_rgba(11,17,32,.55)]">
          <div className="relative h-full w-full overflow-hidden bg-surface-alt">
            {photo ? (
              <Image
                src={photo}
                alt={`${site.instructor.name}, IELTS instructor`}
                fill
                priority
                sizes="(max-width: 1024px) 70vw, 380px"
                className="object-cover object-top"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <span aria-hidden className="text-4xl">
                  🎓
                </span>
                <p className="mt-3 text-sm font-bold text-ink">Instructor photo</p>
                <p className="mt-1 text-xs text-ink-subtle">
                  Add <code>public/instructor.webp</code>
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="absolute -right-2 -top-1 flex h-[88px] w-[88px] items-center justify-center rounded-xl bg-white shadow-[0_20px_38px_-20px_rgba(11,17,32,.5)]">
          <ArcMark size={44} />
        </div>

        <div className="absolute -bottom-4 left-0 flex items-center gap-2.5 rounded-lg bg-ink px-4 py-2.5 text-[11.5px] font-bold tracking-[0.14em] text-white shadow-[0_18px_30px_-18px_rgba(11,17,32,.9)]">
          <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-brand-red" />
          {site.instructor.location.toUpperCase()}
        </div>
      </div>
    </div>
  );
}
