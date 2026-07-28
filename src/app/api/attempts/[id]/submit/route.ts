import { z } from "zod";

import { requireUserApi } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import {
  gradeAndStore,
  isAutoGraded,
  isExpired,
  submitForReview,
  SUBMIT_GRACE_SECONDS,
} from "@/lib/attempts/service";
import { refreshFullMock } from "@/lib/full-mock/service";
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
      fullMockId: true,
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

  // Writing and speaking have no key to mark against. The attempt closes with
  // no band at all rather than a zero, which would drag down a band average
  // that the instructor has not even looked at yet.
  if (!isAutoGraded(loaded.content.skill)) {
    await submitForReview(attempt.id, loaded.content, submission, attempt.startedAt);
    if (attempt.fullMockId) await refreshFullMock(attempt.fullMockId);
    return Response.json({
      awaitingReview: true,
      skill: loaded.content.skill,
      lateSubmission,
      fullMockId: attempt.fullMockId,
    });
  }

  const { result } = await gradeAndStore(
    attempt.id,
    attempt.testId,
    loaded.content,
    loaded.answerKey,
    submission,
    attempt.startedAt,
  );

  if (attempt.fullMockId) await refreshFullMock(attempt.fullMockId);

  return Response.json({
    rawScore: result.rawScore,
    totalQuestions: result.totalQuestions,
    band: result.band,
    scaledScore: result.scaledScore,
    isEstimate: result.isEstimate,
    verdicts: result.verdicts,
    lateSubmission,
    fullMockId: attempt.fullMockId,
  });
}
