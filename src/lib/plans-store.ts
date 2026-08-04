import "server-only";

import { prisma } from "@/lib/db";
import { mergePlans, type PlansConfig } from "@/lib/plans";

/**
 * Reads and writes the plan configuration the instructor edits in the admin
 * panel. It lives in `SiteSetting` rather than in code so prices, wording and
 * material access can change without a deploy.
 */

const KEY = "plans";

export async function loadPlans(): Promise<PlansConfig> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  // Missing or half-written settings fall back to the defaults field by field,
  // so the pricing page can never render a blank price.
  return mergePlans(row?.value);
}

export async function savePlans(plans: PlansConfig): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: plans as unknown as object },
    update: { value: plans as unknown as object },
  });
}
