import type { ReactNode } from "react";

/** One layout for every admin screen: a short masthead, then the work. */
export function AdminPage({
  eyebrow,
  title,
  subtitle,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header className="border-b border-ink/[0.1] bg-white px-6 py-6 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.22em] text-brand-red-cta">{eyebrow}</p>
            <h1 className="mt-1.5 font-display text-[clamp(1.35rem,2.4vw,1.75rem)] leading-[1.05] tracking-[-0.03em] text-ink">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-ink-muted">
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </div>
      </header>

      <div className="px-6 pb-16 pt-6 lg:px-10 lg:pt-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </div>
    </>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="bg-white p-12 text-center text-sm text-ink-subtle">{children}</p>
  );
}
