"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminApi } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { refreshFullMock } from "@/lib/full-mock/service";
import { testAnswerKeySchema } from "@/lib/tests/schema";
import { validateTestImport } from "@/lib/tests/validate";

/**
 * Admin mutations.
 *
 * Every action re-checks the caller. A server action is a public endpoint with
 * a generated name — being unreachable from the admin UI is not access control.
 */

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Import reports more than pass/fail: the instructor needs to see the warnings. */
export type ImportResult =
  | {
      ok: true;
      message: string;
      summary: string;
      warnings: string[];
    }
  | { ok: false; error: string; issues: string[] };

async function assertAdmin(): Promise<{ id: string } | null> {
  const auth = await requireAdminApi();
  return auth.ok ? { id: auth.user.id } : null;
}

const markSchema = z.object({
  attemptId: z.string().min(1),
  // IELTS reports in half bands from 0 to 9.
  band: z.number().min(0).max(9).refine((value) => (value * 2) % 1 === 0, {
    message: "Bands go in halves",
  }),
  feedback: z.string().max(8000).optional(),
});

/**
 * Records a band for a writing or speaking attempt.
 *
 * Writing is written twice on purpose: `WritingSubmission.instructorBand` is the
 * marker's record of what they gave, and `Attempt.band` is what every student
 * screen reads. Keeping the second in step is what makes the work appear on the
 * dashboard, in band history and in a full mock's overall.
 */
export async function markAttempt(input: unknown): Promise<ActionResult> {
  const admin = await assertAdmin();
  if (!admin) return { ok: false, error: "Not allowed" };

  const parsed = markSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid band" };
  }

  const { attemptId, band, feedback } = parsed.data;

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      fullMockId: true,
      result: true,
      test: { select: { skill: true } },
    },
  });

  if (!attempt) return { ok: false, error: "Attempt not found" };
  if (attempt.status !== "SUBMITTED") return { ok: false, error: "That attempt is not finished" };
  if (attempt.test.skill !== "WRITING" && attempt.test.skill !== "SPEAKING") {
    return { ok: false, error: "That test is marked automatically" };
  }

  if (attempt.test.skill === "WRITING") {
    await prisma.writingSubmission.updateMany({
      where: { attemptId },
      data: {
        instructorBand: band,
        instructorFeedback: feedback?.trim() || null,
        reviewedAt: new Date(),
        reviewedById: admin.id,
      },
    });
  }

  await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      band,
      // Speaking has no submission row of its own, so its feedback rides in the
      // attempt's existing marking slot rather than earning a new column.
      ...(attempt.test.skill === "SPEAKING"
        ? {
            result: {
              ...((attempt.result as Record<string, unknown> | null) ?? {}),
              instructorFeedback: feedback?.trim() || null,
              reviewedAt: new Date().toISOString(),
            },
          }
        : {}),
    },
  });

  // A marked section can complete a mock's overall band.
  if (attempt.fullMockId) await refreshFullMock(attempt.fullMockId);

  revalidatePath("/admin/marking");
  revalidatePath(`/admin/marking/${attemptId}`);
  revalidatePath("/dashboard");

  return { ok: true, message: `Band ${band.toFixed(1)} recorded.` };
}

const premiumSchema = z.object({
  userId: z.string().min(1),
  isPremium: z.boolean(),
  note: z.string().max(500).optional(),
});

export async function setPremium(input: unknown): Promise<ActionResult> {
  const admin = await assertAdmin();
  if (!admin) return { ok: false, error: "Not allowed" };

  const parsed = premiumSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const { userId, isPremium, note } = parsed.data;

  await prisma.user.update({
    where: { id: userId },
    data: {
      isPremium,
      premiumGrantedAt: isPremium ? new Date() : null,
      premiumGrantedById: isPremium ? admin.id : null,
      premiumNote: isPremium ? note?.trim() || null : null,
    },
  });

  revalidatePath("/admin/students");
  return { ok: true, message: isPremium ? "Premium granted." : "Premium removed." };
}

const statusSchema = z.object({
  testId: z.string().min(1),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export async function setTestStatus(input: unknown): Promise<ActionResult> {
  const admin = await assertAdmin();
  if (!admin) return { ok: false, error: "Not allowed" };

  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const { testId, status } = parsed.data;

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { skill: true, audioAssetId: true },
  });
  if (!test) return { ok: false, error: "Test not found" };

  // The same rule the seed script and the player enforce, in the one place an
  // instructor can actually trip over it.
  if (status === "PUBLISHED" && test.skill === "LISTENING" && !test.audioAssetId) {
    return { ok: false, error: "Upload the audio before publishing a listening test." };
  }

  await prisma.test.update({
    where: { id: testId },
    data: {
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });

  revalidatePath("/admin/tests");
  revalidatePath("/tests");
  return { ok: true, message: `Test is now ${status.toLowerCase()}.` };
}

/** Pasted JSON, validated by the same checks the conversion scripts run. */
export async function importTest(raw: string): Promise<ImportResult> {
  const admin = await assertAdmin();
  if (!admin) return { ok: false, error: "Not allowed", issues: [] };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      error: "That is not valid JSON.",
      issues: [(error as Error).message],
    };
  }

  const report = validateTestImport(parsedJson);
  if (!report.ok || !report.parsed) {
    const errors = report.issues.filter((issue) => issue.level === "error");
    return {
      ok: false,
      error: `${errors.length} problem${errors.length === 1 ? "" : "s"} stopped this import.`,
      issues: errors.map((issue) => issue.message),
    };
  }

  const warnings = report.issues
    .filter((issue) => issue.level === "warning")
    .map((issue) => issue.message);

  const { content, answerKey, slug, isPremium, audioSourceUrl } = report.parsed;
  const finalSlug =
    slug ??
    content.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const data = {
    skill: content.skill.toUpperCase() as "LISTENING" | "READING" | "WRITING" | "SPEAKING",
    title: content.title,
    description: content.description ?? null,
    isPremium: isPremium ?? false,
    schemaVersion: content.schemaVersion,
    content,
    answerKey,
    totalQuestions: content.totalQuestions,
    durationSeconds: content.durationSeconds,
    source: content.source ?? null,
    audioSourceUrl: audioSourceUrl ?? null,
  };

  const existing = await prisma.test.findUnique({
    where: { slug: finalSlug },
    select: { id: true },
  });

  const stats = report.stats;
  const summary = [
    content.skill,
    stats?.totalQuestions
      ? `${stats.totalQuestions} question${stats.totalQuestions === 1 ? "" : "s"}`
      : null,
    `${Math.round(content.durationSeconds / 60)} minutes`,
    stats?.selfTestScore ? `answer key self-test ${stats.selfTestScore}` : null,
    isPremium ? "premium" : "free",
  ]
    .filter(Boolean)
    .join(" · ");

  if (existing) {
    // Never silently republish: an import that changes questions under a
    // published test should be reviewed before students see it.
    await prisma.test.update({ where: { id: existing.id }, data });
    revalidatePath("/admin/tests");
    return {
      ok: true,
      message: `Updated "${content.title}". Its published status is unchanged.`,
      summary,
      warnings,
    };
  }

  await prisma.test.create({ data: { ...data, slug: finalSlug, status: "DRAFT" } });
  revalidatePath("/admin/tests");
  return {
    ok: true,
    message: `Imported "${content.title}" as a draft.`,
    summary,
    warnings,
  };
}

const reviewSchema = z.object({
  reviewId: z.string().min(1),
  accept: z.boolean(),
});

/**
 * Accepts or rejects a student answer the grader did not recognise.
 *
 * Accepting writes the variant into the test's answer key, so every future
 * sitting marks it correct. Past attempts are deliberately left alone —
 * silently changing a band a student has already seen is worse than the
 * original miss.
 */
export async function decideAnswerReview(input: unknown): Promise<ActionResult> {
  const admin = await assertAdmin();
  if (!admin) return { ok: false, error: "Not allowed" };

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const review = await prisma.answerReview.findUnique({
    where: { id: parsed.data.reviewId },
    select: {
      id: true,
      testId: true,
      questionNumber: true,
      rawExample: true,
      status: true,
    },
  });
  if (!review) return { ok: false, error: "Review not found" };
  if (review.status !== "PENDING") return { ok: false, error: "Already decided" };

  if (parsed.data.accept) {
    const test = await prisma.test.findUnique({
      where: { id: review.testId },
      select: { answerKey: true },
    });
    const key = testAnswerKeySchema.safeParse(test?.answerKey);
    if (!key.success) return { ok: false, error: "That test's answer key is unreadable" };

    const entry = key.data.answers[String(review.questionNumber)];
    if (!entry) return { ok: false, error: "That question has no key entry to extend" };

    if (!entry.accepted.includes(review.rawExample)) {
      entry.accepted.push(review.rawExample);
    }

    await prisma.test.update({
      where: { id: review.testId },
      data: { answerKey: key.data },
    });
  }

  await prisma.answerReview.update({
    where: { id: review.id },
    data: {
      status: parsed.data.accept ? "ACCEPTED" : "REJECTED",
      decidedAt: new Date(),
    },
  });

  revalidatePath("/admin/reviews");
  return {
    ok: true,
    message: parsed.data.accept ? "Added to the answer key." : "Rejected.",
  };
}
