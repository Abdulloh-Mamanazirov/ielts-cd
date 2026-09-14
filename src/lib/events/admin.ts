import "server-only";

import type { EventTestOption } from "@/components/admin/EventForm";
import { prisma } from "@/lib/db";
import { naturalCompare } from "@/lib/utils";

/**
 * The published tests an event can be made of, per section, with the ones
 * reserved for events first — that is what an event is usually built from.
 */
export async function eventTestOptions(): Promise<{
  LISTENING: EventTestOption[];
  READING: EventTestOption[];
  WRITING: EventTestOption[];
}> {
  const rows = await prisma.test.findMany({
    where: { status: "PUBLISHED", skill: { in: ["LISTENING", "READING", "WRITING"] } },
    select: { id: true, title: true, skill: true, eventOnly: true, audioAssetId: true },
  });

  const forSkill = (skill: "LISTENING" | "READING" | "WRITING") =>
    rows
      .filter((row) => row.skill === skill)
      .map((row) => ({
        id: row.id,
        title: row.title,
        eventOnly: row.eventOnly,
        hasAudio: Boolean(row.audioAssetId),
      }))
      .sort(
        (a, b) => Number(b.eventOnly) - Number(a.eventOnly) || naturalCompare(a.title, b.title),
      );

  return { LISTENING: forSkill("LISTENING"), READING: forSkill("READING"), WRITING: forSkill("WRITING") };
}

/** yyyy-mm-ddThh:mm in local time, which is what a datetime-local input wants. */
export function asDateTimeInput(value: Date | null): string {
  if (!value) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
    `T${pad(value.getHours())}:${pad(value.getMinutes())}`
  );
}
