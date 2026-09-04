import Link from "next/link";

import { LogoMark } from "./Brand";
import { site } from "@/content/site";

const QUICK_LINKS = [
  { href: "/tests", label: "Mock tests" },
  { href: "/tests", label: "Practice tests" },
  { href: "/#results", label: "Student results" },
  { href: "/#about", label: "About me" },
];

const RESOURCES = [
  { href: "/#practice", label: "IELTS tips" },
  { href: "/#practice", label: "Vocabulary" },
  { href: "/#practice", label: "Grammar" },
  { href: "/#testimonials", label: "Reviews" },
];

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-8 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-14">
        <div>
          <span className="flex items-center gap-3">
            <LogoMark size={34} />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[15px] tracking-[0.01em]">DAVRONBEK</span>
              <span className="mt-1 text-[9.5px] font-bold tracking-[0.3em] text-white/45">
                IELTS ACADEMIC
              </span>
            </span>
          </span>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60 text-pretty">
            {site.footer.blurb}
          </p>
        </div>

        <FooterColumn title={site.footer.quickLinks} links={QUICK_LINKS} />
        <FooterColumn title={site.footer.resources} links={RESOURCES} />

        <div>
          <h2 className="mb-4 text-[10px] font-bold tracking-[0.22em] text-brand-red">
            {site.footer.contact.toUpperCase()}
          </h2>
          <ul className="space-y-3 text-sm text-white/70">
            <li>
              <a href={`mailto:${site.instructor.email}`} className="transition hover:text-white">
                {site.instructor.email}
              </a>
            </li>
            <li>{site.instructor.location}</li>
            <li>
              <a
                href={site.instructor.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-brand-blue transition hover:text-white"
              >
                {site.instructor.telegramHandle}
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Extra bottom padding on phones clears the pinned CTA bar. */}
      <div className="border-t border-white/10 pb-24 lg:pb-0">
        <p className="mx-auto max-w-[1440px] px-8 py-5 text-center text-xs text-white/40 lg:px-14">
          © {new Date().getFullYear()} {site.instructor.name}. {site.footer.rights}
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h2 className="mb-4 text-[10px] font-bold tracking-[0.22em] text-white/45">
        {title.toUpperCase()}
      </h2>
      <ul className="space-y-3 text-sm">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="text-white/70 transition hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
