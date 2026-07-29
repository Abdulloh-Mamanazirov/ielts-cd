"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { reorder } from "@/lib/admin/order";
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

/** Lowercase words joined by hyphens, matching the schema's slug rule. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type ImportOverrides = {
  title?: string;
  slug?: string;
  isPremium?: boolean;
};

/**
 * Pasted JSON, validated by the same checks the conversion scripts run.
 *
 * The overrides exist because a model's guess at a title and slug is rarely
 * what the instructor wants on the shelf, and whether a test is premium is a
 * commercial decision that has no business being inside the paper.
 */
export async function importTest(
  raw: string,
  overrides: ImportOverrides = {},
): Promise<ImportResult> {
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

  const finalTitle = overrides.title?.trim() || content.title;
  const finalPremium = overrides.isPremium ?? isPremium ?? false;
  const finalSlug = slugify(overrides.slug?.trim() || slug || finalTitle);

  if (!finalSlug) {
    return { ok: false, error: "That title makes an empty web address.", issues: [] };
  }

  const data = {
    skill: content.skill.toUpperCase() as "LISTENING" | "READING" | "WRITING" | "SPEAKING",
    title: finalTitle,
    description: content.description ?? null,
    isPremium: finalPremium,
    schemaVersion: content.schemaVersion,
    // The title lives in two places — the row the admin lists by, and the
    // content the player renders — so an override has to reach both.
    content: { ...content, title: finalTitle },
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
    finalPremium ? "premium" : "free",
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
      message: `Updated "${finalTitle}". Its published status is unchanged.`,
      summary,
      warnings,
    };
  }

  await prisma.test.create({ data: { ...data, slug: finalSlug, status: "DRAFT" } });
  revalidatePath("/admin/tests");
  return {
    ok: true,
    message: `Imported "${finalTitle}" as a draft.`,
    summary,
    warnings,
  };
}

const imageSchema = z.object({
  testId: z.string().min(1),
  /** Writing task number, or a question group id for a map or diagram. */
  target: z.union([z.number().int().positive(), z.string().min(1)]),
  // Relative path from the upload route, never an arbitrary URL: an offsite
  // image would break the moment that host went down or changed the file.
  url: z.string().regex(/^\/test-media\/[A-Za-z0-9._-]+$/, "That is not an uploaded image"),
});

/**
 * Attaches artwork to a task or question group.
 *
 * The picture is deliberately not part of the imported JSON: a model reading a
 * PDF cannot produce one, and asking an instructor to hand-edit a URL into a
 * blob of JSON is how a chart ends up missing from a Task 1 nobody can answer.
 */
export async function setTestImage(input: unknown): Promise<ActionResult> {
  const admin = await assertAdmin();
  if (!admin) return { ok: false, error: "Not allowed" };

  const parsed = imageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }

  const { testId, target, url } = parsed.data;

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { content: true },
  });
  if (!test) return { ok: false, error: "Test not found" };

  const content = test.content as {
    tasks?: Array<{ number: number; imageUrl?: string }>;
    parts?: Array<{ groups: Array<{ id: string; imageUrl?: string }> }>;
  };

  let attached = false;

  if (typeof target === "number") {
    const task = content.tasks?.find((entry) => entry.number === target);
    if (task) {
      task.imageUrl = url;
      attached = true;
    }
  } else {
    for (const part of content.parts ?? []) {
      const group = part.groups.find((entry) => entry.id === target);
      if (group) {
        group.imageUrl = url;
        attached = true;
        break;
      }
    }
  }

  if (!attached) return { ok: false, error: "Nothing in that test matches" };

  await prisma.test.update({ where: { id: testId }, data: { content } });

  revalidatePath("/admin/tests");
  revalidatePath("/tests");
  return { ok: true, message: "Image attached." };
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

/* -------------------------------------------------------------------------- */
/*  Home page showcase: student results and reviews                           */
/* -------------------------------------------------------------------------- */

/** IELTS reports in half bands. The same rule the marking form uses. */
const bandField = z
  .number()
  .min(0)
  .max(9)
  .refine((value) => (value * 2) % 1 === 0, { message: "Bands go in halves" });

/**
 * An image this site is hosting, not one borrowed from elsewhere.
 *
 * Uploads land in `/test-media/`, but seeded rows point at files in the public
 * root, so both shapes have to pass. What is excluded is an absolute URL — a
 * certificate on someone else's host disappears the day they tidy up — and
 * anything carrying a traversal segment.
 */
const localImage = z
  .string()
  .regex(/^\/[A-Za-z0-9][A-Za-z0-9._/-]*$/, "Upload the image rather than linking to one")
  .refine((value) => !value.includes(".."), { message: "Invalid image path" });

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.trim())
    .optional();

const showcaseSchema = z.object({
  id: z.string().min(1).optional(),
  studentName: z.string().min(1, "A name is needed").max(120),
  overallBand: bandField,
  listening: bandField.nullable().optional(),
  reading: bandField.nullable().optional(),
  writing: bandField.nullable().optional(),
  speaking: bandField.nullable().optional(),
  quoteEn: optionalText(600),
  quoteUz: optionalText(600),
  quoteRu: optionalText(600),
  certificateUrl: localImage.nullable().optional(),
  /** `<input type="date">` hands back an empty string when it is cleared. */
  testDate: z.string().max(40).optional(),
  isVisible: z.boolean().default(true),
});

function parseTestDate(value: string | undefined): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Every public page this content appears on, refreshed together. */
function revalidateShowcase() {
  revalidatePath("/admin/showcase");
  revalidatePath("/");
  revalidatePath("/results");
}

export async function saveShowcaseResult(input: unknown): Promise<ActionResult> {
  const admin = await assertAdmin();
  if (!admin) return { ok: false, error: "Not allowed" };

  const parsed = showcaseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }

  const { id, testDate, quoteEn, quoteUz, quoteRu, certificateUrl, ...rest } = parsed.data;

  const data = {
    ...rest,
    quoteEn: quoteEn || null,
    quoteUz: quoteUz || null,
    quoteRu: quoteRu || null,
    certificateUrl: certificateUrl || null,
    testDate: parseTestDate(testDate),
  };

  if (id) {
    await prisma.showcaseResult.update({ where: { id }, data });
    revalidateShowcase();
    return { ok: true, message: `Saved ${data.studentName}.` };
  }

  // New rows go to the bottom, which is where the newest addition belongs
  // until someone decides otherwise.
  const last = await prisma.showcaseResult.findFirst({
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });

  await prisma.showcaseResult.create({
    data: { ...data, displayOrder: (last?.displayOrder ?? -1) + 1 },
  });

  revalidateShowcase();
  return { ok: true, message: `Added ${data.studentName}.` };
}

export async function deleteShowcaseResult(id: string): Promise<ActionResult> {
  const admin = await assertAdmin();
  if (!admin) return { ok: false, error: "Not allowed" };

  await prisma.showcaseResult.delete({ where: { id } });
  revalidateShowcase();
  return { ok: true, message: "Result removed." };
}

export async function moveShowcaseResult(id: string, delta: -1 | 1): Promise<ActionResult> {
  const admin = await assertAdmin();
  if (!admin) return { ok: false, error: "Not allowed" };

  const rows = await prisma.showcaseResult.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const next = reorder(
    rows.map((row) => row.id),
    id,
    delta,
  );
  if (!next) return { ok: false, error: "It is already at the end" };

  await prisma.$transaction(
    next.map((rowId, index) =>
      prisma.showcaseResult.update({ where: { id: rowId }, data: { displayOrder: index } }),
    ),
  );

  revalidateShowcase();
  return { ok: true, message: "Order updated." };
}

const testimonialSchema = z
  .object({
    id: z.string().min(1).optional(),
    studentName: z.string().min(1, "A name is needed").max(120),
    rating: z.number().int().min(1).max(5),
    mediaType: z.enum(["TEXT", "YOUTUBE", "INSTAGRAM"]),
    mediaUrl: z.string().max(500).optional(),
    thumbnailUrl: localImage.nullable().optional(),
    caption: optionalText(300),
    quoteEn: optionalText(1000),
    quoteUz: optionalText(1000),
    quoteRu: optionalText(1000),
    isVisible: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.mediaType === "TEXT") {
      if (!value.quoteEn?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "A written review needs its words",
          path: ["quoteEn"],
        });
      }
      return;
    }

    if (!/^https:\/\//i.test(value.mediaUrl?.trim() ?? "")) {
      ctx.addIssue({
        code: "custom",
        message: "A video review needs an https link to the video",
        path: ["mediaUrl"],
      });
    }
  });

export async function saveTestimonial(input: unknown): Promise<ActionResult> {
  const admin = await assertAdmin();
  if (!admin) return { ok: false, error: "Not allowed" };

  const parsed = testimonialSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }

  const { id, mediaUrl, thumbnailUrl, caption, quoteEn, quoteUz, quoteRu, ...rest } = parsed.data;

  const data = {
    ...rest,
    // A written review has no link to keep, and a stale one left behind means
    // the card renders a play button over nothing.
    mediaUrl: rest.mediaType === "TEXT" ? null : mediaUrl?.trim() || null,
    thumbnailUrl: thumbnailUrl || null,
    caption: caption || null,
    quoteEn: quoteEn || null,
    quoteUz: quoteUz || null,
    quoteRu: quoteRu || null,
  };

  if (id) {
    await prisma.testimonial.update({ where: { id }, data });
    revalidateShowcase();
    return { ok: true, message: `Saved ${data.studentName}.` };
  }

  const last = await prisma.testimonial.findFirst({
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });

  await prisma.testimonial.create({
    data: { ...data, displayOrder: (last?.displayOrder ?? -1) + 1 },
  });

  revalidateShowcase();
  return { ok: true, message: `Added ${data.studentName}.` };
}

export async function deleteTestimonial(id: string): Promise<ActionResult> {
  const admin = await assertAdmin();
  if (!admin) return { ok: false, error: "Not allowed" };

  await prisma.testimonial.delete({ where: { id } });
  revalidateShowcase();
  return { ok: true, message: "Review removed." };
}

export async function moveTestimonial(id: string, delta: -1 | 1): Promise<ActionResult> {
  const admin = await assertAdmin();
  if (!admin) return { ok: false, error: "Not allowed" };

  const rows = await prisma.testimonial.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const next = reorder(
    rows.map((row) => row.id),
    id,
    delta,
  );
  if (!next) return { ok: false, error: "It is already at the end" };

  await prisma.$transaction(
    next.map((rowId, index) =>
      prisma.testimonial.update({ where: { id: rowId }, data: { displayOrder: index } }),
    ),
  );

  revalidateShowcase();
  return { ok: true, message: "Order updated." };
}
