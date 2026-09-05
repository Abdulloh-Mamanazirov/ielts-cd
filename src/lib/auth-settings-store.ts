import "server-only";

import { mergeAuthSettings, type AuthSettings } from "@/lib/auth-settings";
import { prisma } from "@/lib/db";

/** Reads and writes the sign-up switches the instructor edits in the admin panel. */

const KEY = "auth";

export async function loadAuthSettings(): Promise<AuthSettings> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  // A missing or half-written row falls back to the defaults, so a fresh
  // database never opens registration by accident.
  return mergeAuthSettings(row?.value);
}

export async function saveAuthSettings(settings: AuthSettings): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: settings as unknown as object },
    update: { value: settings as unknown as object },
  });
}
