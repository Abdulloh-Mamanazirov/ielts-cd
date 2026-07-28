import { cn } from "@/lib/utils";

/**
 * Left-aligned and rule-anchored rather than centred, so sections inherit the
 * hero's editorial grid instead of each becoming its own centred island.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  onDark = false,
  /** The first heading on a page should be the h1, wherever it sits. */
  level = "h2",
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  onDark?: boolean;
  level?: "h1" | "h2";
  className?: string;
}) {
  const Heading = level;

  return (
    <div className={cn("mb-10", className)}>
      <div className="flex items-center gap-3.5">
        <span
          className={cn(
            "text-[10px] font-bold tracking-[0.22em]",
            onDark ? "text-brand-red" : "text-brand-red-cta",
          )}
        >
          {eyebrow}
        </span>
        <span
          aria-hidden
          className={cn("h-px min-w-6 flex-1", onDark ? "bg-white/20" : "bg-ink-faint")}
        />
      </div>

      <Heading
        className={cn(
          "mt-4 max-w-[22ch] font-display text-[clamp(1.9rem,4vw,3rem)] leading-[0.95] tracking-[-0.03em]",
          onDark ? "text-white" : "text-ink",
        )}
      >
        {title}
      </Heading>

      {subtitle && (
        <p
          className={cn(
            "mt-4 max-w-[52ch] text-base leading-relaxed text-pretty",
            onDark ? "text-white/70" : "text-ink-muted",
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
