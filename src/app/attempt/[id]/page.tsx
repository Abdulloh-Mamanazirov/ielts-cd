import { notFound, redirect } from "next/navigation";

import { SpeakingPlayer } from "@/components/player/SpeakingPlayer";
import { TestPlayer, type AttemptSnapshot } from "@/components/player/TestPlayer";
import { WritingPlayer } from "@/components/player/WritingPlayer";
import { requireUser } from "@/lib/auth/guards";
import { INSTRUCTOR_MARKING_ENABLED } from "@/lib/features";
import type { Annotations } from "@/lib/player/highlights";
import { prisma } from "@/lib/db";
import type { GradeResult, QuestionVerdict } from "@/lib/tests/grade";
import { getPlayableTest } from "@/lib/tests/access";

export default async function AttemptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ review?: string }>;
}) {
  const { id } = await params;
  const { review } = await searchParams;
  const user = await requireUser(`/attempt/${id}${review ? "?review=1" : ""}`);

  const attempt = await prisma.attempt.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      testId: true,
      mode: true,
      status: true,
      answers: true,
      flags: true,
      annotations: true,
      startedAt: true,
      expiresAt: true,
      fullMockId: true,
      rawScore: true,
      band: true,
      result: true,
    },
  });

  if (!attempt) notFound();

  // A finished auto-graded attempt can be re-opened read-only to walk the marked
  // paper (`?review=1`); otherwise a finished attempt belongs on the results page.
  const stored = attempt.result as
    | { verdicts?: QuestionVerdict[]; scaledScore?: number; isEstimate?: boolean }
    | null;
  const wantsReview =
    attempt.status !== "IN_PROGRESS" && Boolean(review) && (stored?.verdicts?.length ?? 0) > 0;

  if (attempt.status !== "IN_PROGRESS" && !wantsReview) {
    redirect(`/dashboard/results/${attempt.id}`);
  }

  // A section of a full mock is opened on the mock's authority: the composition
  // was fixed when it started, and it may legitimately include material the
  // student's plan does not open on the practice shelf.
  const access = await getPlayableTest(attempt.testId, user, {
    insideFullMock: Boolean(attempt.fullMockId),
  });
  if (!access.ok) notFound();

  const snapshot: AttemptSnapshot = {
    id: attempt.id,
    mode: attempt.mode,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt?.toISOString() ?? null,
    answers: (attempt.answers as Record<string, string>) ?? {},
    flags: (attempt.flags as number[]) ?? [],
    annotations: (attempt.annotations as Annotations) ?? {},
    fullMockId: attempt.fullMockId,
  };

  // Three players, one lifecycle. Which one a student gets is decided here and
  // nowhere else.
  // Marking is the paid part. A free student can sit either test and keep the
  // work; they just cannot put it in the instructor's queue. While marking is
  // switched off entirely, nobody can — the work is still saved either way.
  const canRequestReview =
    INSTRUCTOR_MARKING_ENABLED && (user.isPremium || user.role === "ADMIN");

  if (access.test.skill === "writing") {
    return (
      <WritingPlayer test={access.test} attempt={snapshot} canRequestReview={canRequestReview} />
    );
  }
  if (access.test.skill === "speaking") {
    return (
      <SpeakingPlayer test={access.test} attempt={snapshot} canRequestReview={canRequestReview} />
    );
  }

  const initialResult: GradeResult | null = wantsReview
    ? {
        rawScore: attempt.rawScore ?? 0,
        totalQuestions: access.test.totalQuestions,
        band: attempt.band ?? 0,
        scaledScore: stored?.scaledScore ?? attempt.rawScore ?? 0,
        isEstimate: stored?.isEstimate ?? false,
        verdicts: stored?.verdicts ?? [],
      }
    : null;

  return <TestPlayer test={access.test} attempt={snapshot} initialResult={initialResult} />;
}
