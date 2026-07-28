import { z } from "zod";

import { requireUserApi } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { deadlineFor } from "@/lib/attempts/service";
import { getPlayableTest } from "@/lib/tests/access";

const startSchema = z.object({
  testId: z.string().min(1),
  mode: z.enum(["PRACTICE", "MOCK"]),
});

const DENIAL_STATUS: Record<string, number> = {
  not_found: 404,
  not_signed_in: 401,
  premium_required: 403,
  unavailable: 409,
};

const DENIAL_MESSAGE: Record<string, string> = {
  not_found: "Test not found",
  not_signed_in: "Not signed in",
  premium_required: "This test is for premium students",
  unavailable: "This test is not ready to be taken yet",
};

export async function POST(request: Request) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "testId and mode are required" }, { status: 422 });
  }

  const { testId, mode } = parsed.data;
  const access = await getPlayableTest(testId, auth.user);
  if (!access.ok) {
    return Response.json(
      { error: DENIAL_MESSAGE[access.reason] },
      { status: DENIAL_STATUS[access.reason] ?? 400 },
    );
  }

  // Refreshing mid-test must resume, not start over and lose the answers.
  const existing = await prisma.attempt.findFirst({
    where: { userId: auth.user.id, testId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
    select: { id: true, mode: true, startedAt: true, expiresAt: true, answers: true, flags: true, annotations: true },
  });

  if (existing) {
    return Response.json({ attempt: existing, resumed: true });
  }

  const attempt = await prisma.attempt.create({
    data: {
      userId: auth.user.id,
      testId,
      mode,
      expiresAt: deadlineFor(mode, access.test.durationSeconds),
    },
    select: { id: true, mode: true, startedAt: true, expiresAt: true, answers: true, flags: true, annotations: true },
  });

  return Response.json({ attempt, resumed: false }, { status: 201 });
}
