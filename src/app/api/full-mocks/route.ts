import { z } from "zod";

import { requireUserApi } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { planFullMock } from "@/lib/full-mock/service";

const startSchema = z.object({
  includeSpeaking: z.boolean().default(false),
});

export async function POST(request: Request) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Defaults are fine: a mock without speaking is the common case.
  }

  const parsed = startSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json({ error: "Invalid options" }, { status: 422 });
  }

  // One mock at a time. Two running at once would leave a student with two
  // half-finished sets and no way to tell them apart.
  const existing = await prisma.fullMock.findFirst({
    where: { userId: auth.user.id, status: "IN_PROGRESS" },
    select: { id: true },
  });
  if (existing) return Response.json({ fullMock: existing, resumed: true });

  const planned = await planFullMock(auth.user, parsed.data.includeSpeaking);
  if (!planned.ok) {
    return Response.json(
      {
        error: `No test available for ${planned.missing.map((s) => s.toLowerCase()).join(", ")}`,
        missing: planned.missing,
      },
      { status: 409 },
    );
  }

  // Attempts are created up front so the composition is fixed, but each one
  // stays untimed until the student actually opens that section — the reading
  // clock must not run while they are still on listening.
  const fullMock = await prisma.fullMock.create({
    data: {
      userId: auth.user.id,
      includeSpeaking: parsed.data.includeSpeaking,
      attempts: {
        create: planned.plan.map((entry, index) => ({
          userId: auth.user.id,
          testId: entry.testId,
          mode: "MOCK" as const,
          sequence: index + 1,
        })),
      },
    },
    select: { id: true },
  });

  return Response.json({ fullMock, resumed: false }, { status: 201 });
}
