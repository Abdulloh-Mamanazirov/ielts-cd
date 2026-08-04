import { notFound, redirect } from "next/navigation";

import { SpeakingPlayer } from "@/components/player/SpeakingPlayer";
import { TestPlayer, type AttemptSnapshot } from "@/components/player/TestPlayer";
import { WritingPlayer } from "@/components/player/WritingPlayer";
import { requireUser } from "@/lib/auth/guards";
import { INSTRUCTOR_MARKING_ENABLED } from "@/lib/features";
import type { Annotations } from "@/lib/player/highlights";
import { prisma } from "@/lib/db";
import { getPlayableTest } from "@/lib/tests/access";

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/attempt/${id}`);

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
    },
  });

  if (!attempt) notFound();

  // A finished attempt belongs on the results page, not back in the player.
  if (attempt.status !== "IN_PROGRESS") redirect(`/dashboard/results/${attempt.id}`);

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

  return <TestPlayer test={access.test} attempt={snapshot} />;
}
