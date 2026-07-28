import Link from "next/link";

import { cn } from "@/lib/utils";

/** Shared "go to the full page" affordance used at the end of home sections. */
export function SeeAllLink({
  href,
  children,
  onDark = false,
  className,
}: {
  href: string;
  children: React.ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex flex-none items-center gap-3 rounded-[10px] px-6 py-3.5 text-sm font-bold transition",
        onDark
          ? "bg-white/10 text-white hover:bg-white hover:text-ink"
          : "bg-ink text-white hover:bg-brand-blue",
        className,
      )}
    >
      {children}
      <span aria-hidden className="transition group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}
