import { notFound, redirect } from "next/navigation";

import { SpeakingPlayer } from "@/components/player/SpeakingPlayer";
import { TestPlayer, type AttemptSnapshot } from "@/components/player/TestPlayer";
import { WritingPlayer } from "@/components/player/WritingPlayer";
import { requireUser } from "@/lib/auth/guards";
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
      startedAt: true,
      expiresAt: true,
    },
  });

  if (!attempt) notFound();

  // A finished attempt belongs on the results page, not back in the player.
  if (attempt.status !== "IN_PROGRESS") redirect(`/dashboard/results/${attempt.id}`);

  const access = await getPlayableTest(attempt.testId, user);
  if (!access.ok) notFound();

  const snapshot: AttemptSnapshot = {
    id: attempt.id,
    mode: attempt.mode,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt?.toISOString() ?? null,
    answers: (attempt.answers as Record<string, string>) ?? {},
    flags: (attempt.flags as number[]) ?? [],
  };

  // Three players, one lifecycle. Which one a student gets is decided here and
  // nowhere else.
  if (access.test.skill === "writing") {
    return <WritingPlayer test={access.test} attempt={snapshot} />;
  }
  if (access.test.skill === "speaking") {
    return <SpeakingPlayer test={access.test} attempt={snapshot} />;
  }

  return <TestPlayer test={access.test} attempt={snapshot} />;
}
