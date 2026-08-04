import type { Plan, TestSeries } from "@/generated/prisma/enums";

/**
 * Subscription plans: what each one costs, what it promises, and — the part the
 * rest of the app actually enforces — which material it opens and how many full
 * mocks it allows.
 *
 * The shape lives here with sensible defaults; the values are stored in
 * `SiteSetting` under `plans` so the instructor can edit prices, wording and
 * access in the admin panel without a deploy. Anything missing from the stored
 * copy falls back to the default below, so adding a field later cannot leave a
 * live site with a blank price.
 */

/** Which numbered books or volumes of a series a plan opens. */
export type SeriesAccess =
  | { kind: "all" }
  | { kind: "none" }
  /** Specific Volume or Cambridge numbers, e.g. [1, 2]. */
  | { kind: "some"; numbers: number[] };

export type PlanConfig = {
  label: string;
  tagline: string;
  /** Free text, so it can be written in any currency the instructor likes. */
  price: string;
  /** e.g. "per year". Shown under the price. */
  period: string;
  benefits: string[];
  access: Record<TestSeries, SeriesAccess>;
  /** Full mocks allowed per account. `null` means unlimited. */
  fullMocks: number | null;
  /** Draws the card out on the pricing page. */
  featured: boolean;
  /** Hidden from the public pricing page — Student is granted, not bought. */
  inviteOnly: boolean;
};

export type PlansConfig = Record<Plan, PlanConfig>;

export const PLAN_ORDER: Plan[] = ["FREE", "STUDENT", "PREMIUM"];

export const DEFAULT_PLANS: PlansConfig = {
  FREE: {
    label: "Free",
    tagline: "See how the platform works before you commit.",
    price: "0",
    period: "forever",
    benefits: [
      "Volume 1 reading and listening tests",
      "Instant band score and full answer review",
      "See where every answer came from in the passage",
      "One full mock exam",
      "Writing and speaking practice, saved to your dashboard",
    ],
    access: {
      REAL_EXAM: { kind: "some", numbers: [1] },
      CAMBRIDGE: { kind: "none" },
    },
    fullMocks: 1,
    featured: false,
    inviteOnly: false,
  },
  STUDENT: {
    label: "Student",
    tagline: "For students studying with Davronbek.",
    price: "Included",
    period: "with your course",
    benefits: [
      "Every Real Exam volume",
      "Every Cambridge book",
      "Instant band score and full answer review",
      "One full mock exam, with unlimited mocks unlocked before your exam date",
      "Priority support on Telegram",
    ],
    access: {
      REAL_EXAM: { kind: "all" },
      CAMBRIDGE: { kind: "all" },
    },
    fullMocks: 1,
    featured: true,
    inviteOnly: true,
  },
  PREMIUM: {
    label: "Premium",
    tagline: "Everything, for one year.",
    price: "Contact for price",
    period: "per year",
    benefits: [
      "Every Real Exam volume",
      "Every Cambridge book",
      "Unlimited full mock exams",
      "Instant band score and full answer review",
      "New material as soon as it is added",
    ],
    access: {
      REAL_EXAM: { kind: "all" },
      CAMBRIDGE: { kind: "all" },
    },
    fullMocks: null,
    featured: false,
    inviteOnly: false,
  },
};

/**
 * The plan an account is actually on right now.
 *
 * A paid plan runs out: once `planExpiresAt` is in the past the account is back
 * on FREE, without anything having to run on a schedule to demote it.
 */
export function effectivePlan(user: {
  plan: Plan;
  planExpiresAt?: Date | null;
  role?: string;
}): Plan {
  if (user.role === "ADMIN") return "PREMIUM";
  if (user.plan === "FREE") return "FREE";
  if (user.planExpiresAt && user.planExpiresAt.getTime() < Date.now()) return "FREE";
  return user.plan;
}

/** Whether a plan opens a particular book or volume. */
export function allowsSeries(access: SeriesAccess, seriesNumber: number | null): boolean {
  if (access.kind === "all") return true;
  if (access.kind === "none") return false;
  // A test with no number belongs to no set, so it cannot be in a chosen few.
  return seriesNumber !== null && access.numbers.includes(seriesNumber);
}

/** Whether a plan opens a given test. */
export function allowsTest(
  plans: PlansConfig,
  plan: Plan,
  test: { series: TestSeries; seriesNumber: number | null; isPremium?: boolean },
): boolean {
  return allowsSeries(plans[plan].access[test.series], test.seriesNumber);
}

/**
 * How many full mocks this account may sit, and whether it has any left.
 * `unlimitedMocks` is the per-student override the instructor turns on.
 */
export function mockAllowance(
  plans: PlansConfig,
  plan: Plan,
  user: { unlimitedMocks: boolean },
): number | null {
  if (user.unlimitedMocks) return null;
  return plans[plan].fullMocks;
}

/** Merges a stored config over the defaults, field by field. */
export function mergePlans(stored: unknown): PlansConfig {
  if (!stored || typeof stored !== "object") return DEFAULT_PLANS;
  const source = stored as Partial<Record<Plan, Partial<PlanConfig>>>;

  const out = {} as PlansConfig;
  for (const plan of PLAN_ORDER) {
    const base = DEFAULT_PLANS[plan];
    const over = source[plan] ?? {};
    out[plan] = {
      ...base,
      ...over,
      benefits: Array.isArray(over.benefits) && over.benefits.length > 0 ? over.benefits : base.benefits,
      access: {
        REAL_EXAM: over.access?.REAL_EXAM ?? base.access.REAL_EXAM,
        CAMBRIDGE: over.access?.CAMBRIDGE ?? base.access.CAMBRIDGE,
      },
      fullMocks: over.fullMocks === undefined ? base.fullMocks : over.fullMocks,
    };
  }
  return out;
}

/** Human summary of what a series access setting opens, for the admin screen. */
export function describeAccess(access: SeriesAccess): string {
  if (access.kind === "all") return "All";
  if (access.kind === "none") return "None";
  if (access.numbers.length === 0) return "None";
  return access.numbers.join(", ");
}
