import Link from "next/link";

import { Logo } from "./Brand";
import { site } from "@/content/site";
import { getSessionUser } from "@/lib/auth/session";

export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-40 h-[78px] border-b border-ink/[0.09] bg-white">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-9 px-6 lg:px-14">
        <Link href="/" aria-label={`${site.instructor.name} — home`}>
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-[30px] text-sm font-semibold text-ink/[0.66]">
            {site.nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition hover:text-brand-red-cta">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-[9px] bg-ink px-5 py-3 text-sm font-bold text-white transition hover:bg-ink/90"
            >
              My dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3.5 py-2.5 text-sm font-bold text-ink transition hover:text-brand-red-cta"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-[9px] bg-ink px-5 py-3 text-sm font-bold text-white transition hover:bg-ink/90"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
