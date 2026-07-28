import { cn } from "@/lib/utils";

export type BandPoint = {
  id: string;
  band: number;
  label: string;
  date: string;
};

const TARGET_DEFAULT = 7;
const CHART_MAX = 9;

/**
 * Grey is the past, blue is the recent run, and the newest bar is the only red
 * object on the screen — so colour marks movement rather than decorating. The
 * target is drawn as a line, making the gap a distance instead of a sum.
 */
export function BandHistory({
  points,
  target = TARGET_DEFAULT,
}: {
  points: BandPoint[];
  target?: number;
}) {
  if (points.length === 0) return null;

  const recentFrom = Math.max(0, points.length - 3);
  const targetOffset = (target / CHART_MAX) * 100;

  return (
    <section className="bg-white p-6 lg:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[10px] font-bold tracking-[0.22em] text-ink-subtle">BAND HISTORY</h2>
        <p className="text-xs text-ink-subtle">
          Target <strong className="text-ink">{target.toFixed(1)}</strong>
        </p>
      </div>

      <div className="relative mt-8 h-56">
        <div
          aria-hidden
          className="absolute inset-x-0 border-t border-dashed border-ink/30"
          style={{ bottom: `${targetOffset}%` }}
        >
          <span className="absolute -top-2 right-0 bg-white pl-2 text-[10px] font-bold tracking-[0.16em] text-ink-subtle">
            TARGET
          </span>
        </div>

        <ul className="flex h-full items-end gap-2">
          {points.map((point, index) => {
            const isNewest = index === points.length - 1;
            const isRecent = index >= recentFrom && !isNewest;

            return (
              <li key={point.id} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <span
                  className={cn(
                    "mb-2 text-center text-xs font-bold tabular-nums",
                    isNewest ? "text-brand-red" : "text-ink",
                  )}
                >
                  {point.band.toFixed(1)}
                </span>
                <div
                  role="img"
                  aria-label={`${point.label}: band ${point.band.toFixed(1)}`}
                  className={cn(
                    "w-full origin-bottom animate-[var(--animate-grow-y)] rounded-t-sm",
                    // Red is spent on one thing only: the most recent attempt.
                    isNewest ? "bg-brand-red" : isRecent ? "bg-brand-blue" : "bg-ink/15",
                  )}
                  style={{
                    height: `${(point.band / CHART_MAX) * 100}%`,
                    animationDelay: `${index * 60}ms`,
                  }}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <ul className="mt-3 flex gap-2 text-center">
        {points.map((point) => (
          <li key={point.id} className="min-w-0 flex-1 truncate text-[10px] text-ink-subtle">
            {point.date}
          </li>
        ))}
      </ul>
    </section>
  );
}
