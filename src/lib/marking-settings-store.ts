import "server-only";

import { prisma } from "@/lib/db";
import { mergeMarkingSettings, type MarkingSettings } from "@/lib/marking-settings";

/** Reads and writes which plans may send work to the instructor for marking. */

const KEY = "marking";

export async function loadMarkingSettings(): Promise<MarkingSettings> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  return mergeMarkingSettings(row?.value);
}

export async function saveMarkingSettings(settings: MarkingSettings): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: settings as unknown as object },
    update: { value: settings as unknown as object },
  });
}
