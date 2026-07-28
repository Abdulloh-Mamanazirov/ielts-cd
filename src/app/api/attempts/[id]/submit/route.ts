import { z } from "zod";

import { requireUserApi } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { gradeAndStore, isExpired, SUBMIT_GRACE_SECONDS } from "@/lib/attempts/service";
import { getAnswerKey } from "@/lib/tests/access";

const submitSchema = z.object({
  /** Final answers from the client, merged over whatever was autosaved. */
  answers: z.record(z.string().regex(/^\d+$/), z.string()).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // A submit triggered by the timer running out sends no body.
  }

  const parsed = submitSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json({ error: "Invalid submission payload" }, { status: 422 });
  }

  const attempt = await prisma.attempt.findFirst({
    where: { id, userId: auth.user.id },
    select: {
      id: true,
      testId: true,
      status: true,
      answers: true,
      startedAt: true,
      expiresAt: true,
    },
  });

  if (!attempt) return Response.json({ error: "Attempt not found" }, { status: 404 });
  if (attempt.status !== "IN_PROGRESS") {
    return Response.json({ error: "Already submitted" }, { status: 409 });
  }

  const loaded = await getAnswerKey(attempt.testId);
  if (!loaded) return Response.json({ error: "Test is unavailable" }, { status: 409 });

  // Answers sent after the deadline are dropped, but everything autosaved
  // before it still counts — running out of time must not cost a student marks
  // they had already earned.
  const lateSubmission = isExpired(attempt.expiresAt, SUBMIT_GRACE_SECONDS);
  const submission = {
    ...(attempt.answers as Record<string, string>),
    ...(lateSubmission ? {} : (parsed.data.answers ?? {})),
  };

  const { result } = await gradeAndStore(
    attempt.id,
    attempt.testId,
    loaded.content,
    loaded.answerKey,
    submission,
    attempt.startedAt,
  );

  return Response.json({
    rawScore: result.rawScore,
    totalQuestions: result.totalQuestions,
    band: result.band,
    scaledScore: result.scaledScore,
    isEstimate: result.isEstimate,
    verdicts: result.verdicts,
    lateSubmission,
  });
}
