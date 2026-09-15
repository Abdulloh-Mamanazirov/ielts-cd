import "server-only";

import { prisma } from "@/lib/db";
import { mergeMockSettings, type MockSettings } from "@/lib/mock-settings";

const KEY = "mock";

export async function loadMockSettings(): Promise<MockSettings> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  return mergeMockSettings(row?.value);
}

export async function saveMockSettings(settings: MockSettings): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: settings as unknown as object },
    update: { value: settings as unknown as object },
  });
}
