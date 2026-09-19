import { notFound, redirect } from "next/navigation";

import { SpeakingPlayer } from "@/components/player/SpeakingPlayer";
import { TestPlayer, type AttemptSnapshot } from "@/components/player/TestPlayer";
import { WritingPlayer } from "@/components/player/WritingPlayer";
import { requireUser } from "@/lib/auth/guards";
import type { Annotations } from "@/lib/player/highlights";
import { prisma } from "@/lib/db";
import { canRequestReview as markingAllows } from "@/lib/marking-settings";
import { loadMarkingSettings } from "@/lib/marking-settings-store";
import { revealsAnswers, revealsBands } from "@/lib/mock-settings";
import { loadMockSettings } from "@/lib/mock-settings-store";
import { effectivePlan } from "@/lib/plans";
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
      fullMock: { select: { eventId: true } },
      rawScore: true,
      band: true,
      result: true,
    },
  });

  if (!attempt) notFound();
  const inEvent = Boolean(attempt.fullMock?.eventId);

  // A finished auto-graded attempt can be re-opened read-only to walk the marked
  // paper (`?review=1`); otherwise a finished attempt belongs on the results page.
  const stored = attempt.result as
    | { verdicts?: QuestionVerdict[]; scaledScore?: number; isEstimate?: boolean }
    | null;
  // Whether a mock may show its marking and its numbers is the instructor's
  // switch; practice always may.
  const mockSettings = await loadMockSettings();
  const showAnswers = revealsAnswers(mockSettings, attempt.mode);
  const showBands = revealsBands(mockSettings, attempt.mode);

  const wantsReview =
    attempt.status !== "IN_PROGRESS" &&
    Boolean(review) &&
    showAnswers &&
    (stored?.verdicts?.length ?? 0) > 0;

  if (attempt.status !== "IN_PROGRESS" && !wantsReview) {
    redirect(`/dashboard/results/${attempt.id}`);
  }

  // A section of a full mock is opened on the mock's authority: the composition
  // was fixed when it started, and it may legitimately include material the
  // student's plan does not open on the practice shelf.
  const access = await getPlayableTest(attempt.testId, user, {
    insideFullMock: Boolean(attempt.fullMockId),
    insideEvent: inEvent,
  });
  if (!access.ok) notFound();

  const snapshot: AttemptSnapshot = {
    id: attempt.id,
    mode: attempt.mode,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt?.toISOString() ?? null,
    // The deadline is only meaningful next to the clock that set it. A student
    // whose device clock is hours out would otherwise see a nonsense countdown.
    serverNow: new Date().toISOString(),
    answers: (attempt.answers as Record<string, string>) ?? {},
    flags: (attempt.flags as number[]) ?? [],
    annotations: (attempt.annotations as Annotations) ?? {},
    fullMockId: attempt.fullMockId,
  };

  // Three players, one lifecycle. Which one a student gets is decided here and
  // nowhere else.
  // Whether the work can go to the instructor is a per-plan switch in the admin
  // panel; an event essay always does, since marking it is what the event is
  // for. Either way the work is saved.
  const canRequestReview = markingAllows(
    await loadMarkingSettings(),
    user,
    effectivePlan(user),
    inEvent,
  );

  if (access.test.skill === "writing") {
    return (
      <WritingPlayer
        test={access.test}
        attempt={snapshot}
        canRequestReview={canRequestReview}
        reviewRequired={inEvent}
      />
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

  return (
    <TestPlayer
      test={access.test}
      attempt={snapshot}
      initialResult={initialResult}
      // A mock whose marking or numbers are withheld cannot open them in place
      // after submitting; it goes to the results page, which shows what it may.
      marksInPlace={showAnswers && showBands}
    />
  );
}
