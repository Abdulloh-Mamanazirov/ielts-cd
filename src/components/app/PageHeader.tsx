/** Shared header for the logged-in pages, on the same editorial grid as the site. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="relative overflow-hidden bg-white px-6 py-10 lg:px-10 lg:py-12">
      <div aria-hidden className="om-grid-lines absolute inset-0" />
      <div className="relative mx-auto flex max-w-4xl flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold tracking-[0.22em] text-brand-red-cta">
              {eyebrow}
            </span>
            <span aria-hidden className="h-px w-8 bg-ink-faint" />
          </div>
          <h1 className="mt-3 font-display text-[clamp(1.7rem,3.5vw,2.5rem)] leading-[0.98] tracking-[-0.03em] text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-ink-muted text-pretty">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}
