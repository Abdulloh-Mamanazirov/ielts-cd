"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { INSTRUCTOR_MARKING_ENABLED } from "@/lib/features";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview", exact: true },
  // Marking is hidden while instructor submission is switched off — there is
  // nothing for the queue to receive.
  ...(INSTRUCTOR_MARKING_ENABLED
    ? [{ href: "/admin/marking", label: "Marking", badge: "marking" as const }]
    : []),
  { href: "/admin/reviews", label: "Answer reviews", badge: "reviews" as const },
  { href: "/admin/tests", label: "Tests" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/showcase", label: "Results & reviews" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({
  awaitingMarking,
  pendingReviews,
}: {
  awaitingMarking: number;
  pendingReviews: number;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="px-3">
      <ul className="flex gap-1 overflow-x-auto pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const count =
            item.badge === "marking"
              ? awaitingMarking
              : item.badge === "reviews"
                ? pendingReviews
                : 0;

          return (
            <li key={item.href} className="flex-none lg:w-full">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition",
                  active ? "bg-white text-ink" : "text-white/65 hover:bg-white/10 hover:text-white",
                )}
              >
                {item.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums",
                      active ? "bg-brand-red text-white" : "bg-brand-red text-white",
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
