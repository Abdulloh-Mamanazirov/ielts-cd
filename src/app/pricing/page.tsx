import Link from "next/link";

import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { getSessionUser } from "@/lib/auth/session";
import { site } from "@/content/site";
import { effectivePlan, PLAN_ORDER } from "@/lib/plans";
import { loadPlans } from "@/lib/plans-store";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Plans and pricing",
  description:
    "Free, Student and Premium plans for Davronbek Nabiev's IELTS mock test platform. Compare what each one opens.",
};

export default async function PricingPage() {
  const [plans, user] = await Promise.all([loadPlans(), getSessionUser()]);
  const current = user ? effectivePlan(user) : null;

  // Student is granted by the instructor rather than bought, so it is only
  // shown to the people it applies to.
  const visible = PLAN_ORDER.filter(
    (plan) => !plans[plan].inviteOnly || current === plan || user?.role === "ADMIN",
  );

  return (
    <>
      <SiteHeader />

      <main>
        <section className="bg-surface-alt px-6 pb-16 pt-14 lg:px-14 lg:pb-24 lg:pt-20">
          <div className="mx-auto max-w-[1100px]">
            <p className="text-[10px] font-bold tracking-[0.22em] text-brand-red">PLANS</p>
            <h1 className="mt-3 max-w-[16ch] font-display text-4xl leading-[1.02] tracking-[-0.03em] text-ink lg:text-6xl">
              Practise free. Upgrade when you are serious.
            </h1>
            <p className="mt-5 max-w-[58ch] text-base leading-relaxed text-ink-muted">
              Every plan marks your reading and listening instantly, shows the band, and points at
              the exact line in the passage each answer came from.
            </p>

            <div
              className={cn(
                "mt-12 grid gap-5",
                visible.length === 3 ? "lg:grid-cols-3" : "sm:grid-cols-2",
              )}
            >
              {visible.map((plan, index) => {
                const config = plans[plan];
                const isCurrent = current === plan;

                return (
                  <div
                    key={plan}
                    className={cn(
                      "flex animate-[var(--animate-rise)] flex-col rounded-2xl p-7 transition duration-300 hover:-translate-y-1",
                      config.featured
                        ? "bg-ink text-white shadow-[0_30px_60px_-30px_rgba(11,17,32,.7)]"
                        : "bg-white shadow-[0_1px_2px_rgba(11,17,32,.08)] hover:shadow-[0_28px_50px_-24px_rgba(11,17,32,.35)]",
                    )}
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={cn(
                          "text-[10px] font-bold tracking-[0.22em]",
                          config.featured ? "text-brand-red" : "text-brand-blue",
                        )}
                      >
                        {config.label.toUpperCase()}
                      </p>
                      {isCurrent && (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.14em]",
                            config.featured ? "bg-white/15 text-white" : "bg-ok-soft text-ok",
                          )}
                        >
                          YOUR PLAN
                        </span>
                      )}
                    </div>

                    <p
                      className={cn(
                        "mt-4 font-display text-3xl leading-none tracking-[-0.02em]",
                        config.featured ? "text-white" : "text-ink",
                      )}
                    >
                      {config.price}
                    </p>
                    <p
                      className={cn(
                        "mt-1.5 text-xs font-semibold",
                        config.featured ? "text-white/55" : "text-ink-subtle",
                      )}
                    >
                      {config.period}
                    </p>

                    <p
                      className={cn(
                        "mt-4 text-sm leading-relaxed",
                        config.featured ? "text-white/70" : "text-ink-muted",
                      )}
                    >
                      {config.tagline}
                    </p>

                    <ul className="mt-6 flex-1 space-y-2.5">
                      {config.benefits.map((benefit) => (
                        <li key={benefit} className="flex gap-2.5 text-sm leading-snug">
                          <span
                            aria-hidden
                            className={cn(
                              "mt-[3px] flex-none font-bold",
                              config.featured ? "text-brand-red" : "text-ok",
                            )}
                          >
                            ✓
                          </span>
                          <span className={config.featured ? "text-white/85" : "text-ink-muted"}>
                            {benefit}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <PlanCta plan={plan} featured={config.featured} isCurrent={isCurrent} />
                  </div>
                );
              })}
            </div>

            <p className="mt-10 max-w-[62ch] text-sm leading-relaxed text-ink-subtle">
              Paid plans run for one year. To upgrade, message{" "}
              <a
                href={site.instructor.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-brand-blue underline-offset-4 hover:underline"
              >
                {site.instructor.telegramHandle}
              </a>{" "}
              on Telegram and your account is unlocked the same day.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function PlanCta({
  plan,
  featured,
  isCurrent,
}: {
  plan: string;
  featured: boolean;
  isCurrent: boolean;
}) {
  if (isCurrent) {
    return (
      <span
        className={cn(
          "mt-7 block rounded-[10px] px-6 py-3.5 text-center text-sm font-bold",
          featured ? "bg-white/10 text-white/70" : "bg-surface-alt text-ink-subtle",
        )}
      >
        You are on this plan
      </span>
    );
  }

  if (plan === "FREE") {
    return (
      <Link
        href="/signup"
        className="mt-7 block rounded-[10px] bg-surface-alt px-6 py-3.5 text-center text-sm font-bold text-ink transition hover:bg-ink hover:text-white"
      >
        Create a free account
      </Link>
    );
  }

  return (
    <a
      href={site.instructor.telegram}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "mt-7 block rounded-[10px] px-6 py-3.5 text-center text-sm font-bold text-white transition",
        featured ? "bg-brand-red-cta hover:bg-brand-red-dark" : "bg-ink hover:bg-ink/90",
      )}
    >
      Ask about {plan === "STUDENT" ? "Student" : "Premium"}
    </a>
  );
}
