import Link from "next/link";

import { ArcMark } from "@/components/marketing/Brand";
import { SkillIcon } from "@/components/SkillIcon";
import { LogoutButton } from "./LogoutButton";
import type { SessionUser } from "@/lib/auth/session";
import { SKILLS } from "@/lib/skills";
import { cn } from "@/lib/utils";

/**
 * Navy rail, paper working area. Fixed at 248px so nav labels can grow ~30% in
 * Russian without reflowing the content column.
 *
 * The four skills are listed individually rather than behind one "Practice"
 * entry: a student thinks in skills, and it makes the weak one a single click
 * away from anywhere.
 */
export function AppShell({
  user,
  current,
  children,
}: {
  user: SessionUser;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col bg-ink text-white lg:sticky lg:top-0 lg:h-dvh lg:w-[248px] lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-5 py-5 lg:block">
          <Link href="/" className="flex items-center gap-3">
            <ArcMark size={30} />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[13px] tracking-[0.01em]">DAVRONBEK</span>
              <span className="mt-1 text-[8.5px] font-bold tracking-[0.28em] text-white/45">
                IELTS ACADEMIC
              </span>
            </span>
          </Link>
          <div className="lg:hidden">
            <LogoutButton compact />
          </div>
        </div>

        <nav aria-label="Account" className="px-3 lg:mt-2 lg:flex-1">
          <ul className="flex gap-1 overflow-x-auto pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
            <NavItem href="/dashboard" label="Dashboard" current={current} icon="grid" />

            <NavGroupLabel>Practice</NavGroupLabel>

            {SKILLS.map((skill) => (
              <NavItem
                key={skill.slug}
                href={`/tests?skill=${skill.slug}`}
                label={skill.name}
                current={current}
                skill={skill.slug}
              />
            ))}

            <NavItem href="/tests?skill=full" label="Full mock" current={current} skill="full" />

            <NavGroupLabel>More</NavGroupLabel>

            <NavItem href="/results" label="Student results" current={current} icon="star" />
          </ul>
        </nav>

        <div className="hidden border-t border-white/10 px-5 py-4 lg:block">
          <p className="truncate text-sm font-bold">{user.fullName}</p>
          <p className="mt-0.5 truncate text-xs text-white/50">{user.email}</p>
          <span
            className={cn(
              "mt-3 inline-block rounded-full px-2.5 py-1 text-[9.5px] font-bold tracking-[0.16em]",
              user.isPremium ? "bg-brand-red text-white" : "bg-white/10 text-white/70",
            )}
          >
            {user.isPremium ? "PREMIUM" : "FREE ACCOUNT"}
          </span>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 bg-surface-alt">{children}</div>
    </div>
  );
}

function NavGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <li className="hidden px-3.5 pb-1 pt-5 text-[9.5px] font-bold tracking-[0.22em] text-white/35 lg:block">
      {String(children).toUpperCase()}
    </li>
  );
}

function NavItem({
  href,
  label,
  current,
  icon,
  skill,
}: {
  href: string;
  label: string;
  current: string;
  icon?: "grid" | "star";
  skill?: string;
}) {
  const active = current === href;

  return (
    <li className="flex-none lg:w-full">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition",
          active ? "bg-white text-ink" : "text-white/65 hover:bg-white/10 hover:text-white",
        )}
      >
        {skill ? (
          <SkillIcon
            skill={skill}
            size={17}
            className={cn("flex-none", active ? "text-brand-blue" : "text-current")}
          />
        ) : (
          <NavIcon name={icon ?? "grid"} />
        )}
        {label}
      </Link>
    </li>
  );
}

function NavIcon({ name }: { name: "grid" | "star" }) {
  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    star: <path d="m12 3.5 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8Z" />,
  };

  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="flex-none"
    >
      {paths[name]}
    </svg>
  );
}
