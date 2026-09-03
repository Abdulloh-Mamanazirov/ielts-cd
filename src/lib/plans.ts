import type { Plan, Skill, TestSeries } from "@/generated/prisma/enums";

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

/**
 * Which writing or speaking tests a plan opens.
 *
 * These belong to no numbered volume or book, so they cannot be ticked off by
 * number the way the series access works. They are chosen by slug instead, which
 * also means a plan keeps exactly the tests it was given when new ones are added.
 */
export type TestAccess =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "some"; slugs: string[] };

export type SkillAccess = { WRITING: TestAccess; SPEAKING: TestAccess };

export type PlanConfig = {
  label: string;
  tagline: string;
  /** Free text, so it can be written in any currency the instructor likes. */
  price: string;
  /** e.g. "per year". Shown under the price. */
  period: string;
  benefits: string[];
  access: Record<TestSeries, SeriesAccess>;
  skills: SkillAccess;
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
    skills: { WRITING: { kind: "all" }, SPEAKING: { kind: "all" } },
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
    skills: { WRITING: { kind: "all" }, SPEAKING: { kind: "all" } },
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
    skills: { WRITING: { kind: "all" }, SPEAKING: { kind: "all" } },
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

/** Whether a plan opens a particular writing or speaking test. */
export function allowsSkillTest(access: TestAccess, slug: string | undefined): boolean {
  if (access.kind === "all") return true;
  if (access.kind === "none") return false;
  // Without a slug there is nothing to match, so a chosen few cannot include it.
  return slug !== undefined && access.slugs.includes(slug);
}

/** Whether a plan opens a given test. */
export function allowsTest(
  plans: PlansConfig,
  plan: Plan,
  test: {
    skill?: Skill;
    slug?: string;
    series: TestSeries;
    seriesNumber: number | null;
    isPremium?: boolean;
  },
): boolean {
  // Writing and speaking sit in no numbered set, so the series access cannot
  // describe them; each plan picks them individually, by slug.
  if (test.skill === "WRITING" || test.skill === "SPEAKING") {
    return allowsSkillTest(plans[plan].skills[test.skill], test.slug);
  }

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
      // A config stored before this field existed keeps the old behaviour,
      // which was writing and speaking open on every plan.
      skills: {
        WRITING: over.skills?.WRITING ?? base.skills.WRITING,
        SPEAKING: over.skills?.SPEAKING ?? base.skills.SPEAKING,
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

/** The same, for a writing or speaking selection. */
export function describeTestAccess(access: TestAccess): string {
  if (access.kind === "all") return "All";
  if (access.kind === "none" || access.slugs.length === 0) return "None";
  return `${access.slugs.length} selected`;
}
