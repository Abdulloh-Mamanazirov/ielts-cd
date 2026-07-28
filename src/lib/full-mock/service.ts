import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { overallBand } from "@/lib/tests/bands";
import { chooseForSkill, FULL_MOCK_ORDER } from "./select";
import type { Skill } from "@/generated/prisma/enums";

/**
 * A full mock is one test per skill, sat back to back in exam order.
 *
 * The composition is decided once, when the mock starts, and recorded as real
 * Attempt rows. Picking lazily would let the set change under a student who
 * paused overnight, and would make "which tests were in my mock?" unanswerable
 * afterwards.
 *
 * The rules for choosing live in ./select, which has no database import so they
 * can be tested on their own.
 */

export { FULL_MOCK_ORDER, isExamLength, chooseForSkill } from "./select";
export type { Candidate } from "./select";

export type FullMockPlanEntry = {
  skill: Skill;
  testId: string;
  title: string;
  durationSeconds: number;
};

export type PlanFailure = { ok: false; missing: Skill[] };

/**
 * Chooses the tests for one mock.
 *
 * The conditions, in order of importance:
 *  - published, and within the student's entitlement — a free student must
 *    never be handed a premium test they then cannot open;
 *  - a listening test must have its audio, or the sitting stalls at part 1;
 *  - a whole exam section rather than a shortened practice;
 *  - one the student has not already sat.
 *
 * See `chooseForSkill` for how the last two trade off.
 */
export async function planFullMock(
  user: SessionUser,
  includeSpeaking: boolean,
): Promise<{ ok: true; plan: FullMockPlanEntry[] } | PlanFailure> {
  const skills = FULL_MOCK_ORDER.filter((skill) => includeSpeaking || skill !== "SPEAKING");
  const canUsePremium = user.isPremium || user.role === "ADMIN";

  const candidates = await prisma.test.findMany({
    where: {
      status: "PUBLISHED",
      skill: { in: skills },
      ...(canUsePremium ? {} : { isPremium: false }),
    },
    select: {
      id: true,
      skill: true,
      title: true,
      totalQuestions: true,
      durationSeconds: true,
      audioAssetId: true,
    },
  });

  // One query rather than one per skill: which of these has the student sat,
  // and when did they last do so.
  const seen = await prisma.attempt.groupBy({
    by: ["testId"],
    where: { userId: user.id, status: "SUBMITTED", testId: { in: candidates.map((t) => t.id) } },
    _max: { submittedAt: true },
  });
  const lastSat = new Map(seen.map((row) => [row.testId, row._max.submittedAt?.getTime() ?? 0]));

  const plan: FullMockPlanEntry[] = [];
  const missing: Skill[] = [];

  for (const skill of skills) {
    const pool = candidates.filter(
      (test) => test.skill === skill && (skill !== "LISTENING" || test.audioAssetId),
    );

    const chosen = chooseForSkill(pool, lastSat);
    if (!chosen) {
      missing.push(skill);
      continue;
    }

    const record = candidates.find((test) => test.id === chosen.id)!;
    plan.push({
      skill,
      testId: record.id,
      title: record.title,
      durationSeconds: record.durationSeconds,
    });
  }

  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, plan };
}

/** Skills with no sittable test, so the UI can say what is blocking a mock. */
export async function fullMockBlockers(user: SessionUser | null): Promise<Skill[]> {
  const canUsePremium = Boolean(user && (user.isPremium || user.role === "ADMIN"));

  const available = await prisma.test.findMany({
    where: { status: "PUBLISHED", ...(canUsePremium ? {} : { isPremium: false }) },
    select: { skill: true, audioAssetId: true },
  });

  return FULL_MOCK_ORDER.filter(
    (skill) =>
      !available.some(
        (test) => test.skill === skill && (skill !== "LISTENING" || test.audioAssetId),
      ),
  );
}

/**
 * Closes a mock once every section is in, and records an overall band.
 *
 * The band is only set when all four sections have one. Writing and speaking
 * wait on the instructor, so a mock sat today may complete today and gain its
 * overall band a week later — averaging early would publish a number that
 * silently changes.
 */
export async function refreshFullMock(fullMockId: string) {
  const mock = await prisma.fullMock.findUnique({
    where: { id: fullMockId },
    select: {
      id: true,
      status: true,
      attempts: { select: { status: true, band: true } },
    },
  });

  if (!mock || mock.attempts.length === 0) return null;

  const allSubmitted = mock.attempts.every((attempt) => attempt.status === "SUBMITTED");
  if (!allSubmitted) return mock.status;

  const bands = mock.attempts.map((attempt) => attempt.band).filter((b): b is number => b !== null);
  const everySkillMarked = bands.length === mock.attempts.length;

  await prisma.fullMock.update({
    where: { id: fullMockId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      overallBand: everySkillMarked ? overallBand(bands) : null,
    },
  });

  return "COMPLETED" as const;
}
