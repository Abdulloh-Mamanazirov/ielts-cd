import { prisma } from "@/lib/db";
import { gradeSubmission, type Submission } from "@/lib/tests/grade";
import { countWords, normalizeAnswer } from "@/lib/tests/normalize";
import { groupByQuestionNumber } from "@/lib/tests/slots";
import type { QuestionGroup, TestAnswerKey, TestContent } from "@/lib/tests/schema";

/** Grace given to a mock submission that arrives just after the deadline. */
const SUBMIT_GRACE_SECONDS = 20;

export function isExpired(expiresAt: Date | null, graceSeconds = 0): boolean {
  if (!expiresAt) return false;
  return Date.now() > expiresAt.getTime() + graceSeconds * 1000;
}

export function deadlineFor(mode: "PRACTICE" | "MOCK", durationSeconds: number): Date | null {
  // Practice is untimed by design: the timer counts up and can be paused.
  return mode === "MOCK" ? new Date(Date.now() + durationSeconds * 1000) : null;
}

/**
 * True when a question is answered by typing rather than by picking a letter.
 * Only these feed the unrecognized-answer queue — a wrong letter is simply
 * wrong, whereas a wrong typed answer may be a variant the key is missing.
 */
function isTypedGroup(group: QuestionGroup | undefined): boolean {
  if (!group) return false;
  if (group.wordBank && group.wordBank.length > 0) return false;
  return group.type === "completion" || group.type === "short_answer";
}

export async function gradeAndStore(
  attemptId: string,
  testId: string,
  content: TestContent,
  answerKey: TestAnswerKey,
  submission: Submission,
  startedAt: Date,
) {
  const result = gradeSubmission(content, answerKey, submission);
  const timeSpentSeconds = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));

  const attempt = await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      timeSpentSeconds,
      answers: submission,
      result: {
        verdicts: result.verdicts,
        scaledScore: result.scaledScore,
        isEstimate: result.isEstimate,
      },
      rawScore: result.rawScore,
      band: result.band,
    },
    select: { id: true, rawScore: true, band: true },
  });

  await recordUnrecognizedAnswers(testId, content, result.verdicts);

  return { attempt, result };
}

/** Skills a machine can mark. The other two go to the instructor. */
export function isAutoGraded(skill: TestContent["skill"]): boolean {
  return skill === "listening" || skill === "reading";
}

/**
 * Closes a writing or speaking attempt. There is no score: `band` stays null
 * until an instructor sets one, which is what the dashboard reads to tell
 * "awaiting marking" apart from "marked".
 *
 * Writing text is lifted out of the attempt's answers map into its own row so
 * the instructor's queue can be a plain query rather than a JSON dig.
 */
export async function submitForReview(
  attemptId: string,
  content: TestContent,
  answers: Record<string, string>,
  startedAt: Date,
) {
  const timeSpentSeconds = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));

  if (content.skill === "writing") {
    const task1Text = answers["1"] ?? "";
    const task2Text = answers["2"] ?? null;

    const fields = {
      task1Text,
      task2Text,
      task1WordCount: countWords(task1Text),
      task2WordCount: countWords(task2Text ?? ""),
    };

    await prisma.writingSubmission.upsert({
      where: { attemptId },
      create: { attemptId, ...fields },
      update: fields,
    });
  }

  await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      timeSpentSeconds,
      answers,
      rawScore: null,
      band: null,
    },
  });

  return { timeSpentSeconds };
}

/**
 * Groups the typed answers students got wrong so the instructor can accept the
 * legitimate ones into the key. Failures here must not break a submission, so
 * the whole thing is best-effort.
 */
async function recordUnrecognizedAnswers(
  testId: string,
  content: TestContent,
  verdicts: Array<{ number: number; correct: boolean; submitted: string; overWordLimit?: boolean }>,
) {
  const groups = groupByQuestionNumber(content);

  const candidates = verdicts.filter(
    (verdict) =>
      !verdict.correct &&
      !verdict.overWordLimit &&
      verdict.submitted.trim().length > 0 &&
      isTypedGroup(groups.get(verdict.number)),
  );

  for (const verdict of candidates) {
    const normalized = normalizeAnswer(verdict.submitted);
    if (!normalized) continue;

    try {
      await prisma.answerReview.upsert({
        where: {
          testId_questionNumber_normalizedAnswer: {
            testId,
            questionNumber: verdict.number,
            normalizedAnswer: normalized,
          },
        },
        create: {
          testId,
          questionNumber: verdict.number,
          normalizedAnswer: normalized,
          rawExample: verdict.submitted.slice(0, 200),
        },
        update: { occurrences: { increment: 1 } },
      });
    } catch {
      // A review row is a nicety, never a reason to fail a student's submission.
    }
  }
}

export { SUBMIT_GRACE_SECONDS };
