import { prisma } from "@/lib/db";
import { canAccessTest } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { testContentSchema, testAnswerKeySchema, type TestContent, type TestAnswerKey } from "./schema";

export type AccessDenial = "not_found" | "not_signed_in" | "premium_required" | "unavailable";

export type PlayableTest = {
  id: string;
  slug: string;
  title: string;
  skill: "listening" | "reading" | "writing" | "speaking";
  isPremium: boolean;
  durationSeconds: number;
  totalQuestions: number;
  hasAudio: boolean;
  /** Recorded at upload, so the player can show a length before the file loads. */
  audioDurationSeconds: number | null;
  content: TestContent;
};

/**
 * Loads a test for the player. The answer key is read in a separate function
 * that is never called from a component, so there is no path by which it can be
 * serialized into the page.
 */
export async function getPlayableTest(
  testId: string,
  user: SessionUser | null,
): Promise<{ ok: true; test: PlayableTest } | { ok: false; reason: AccessDenial }> {
  const record = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      slug: true,
      title: true,
      skill: true,
      isPremium: true,
      status: true,
      durationSeconds: true,
      totalQuestions: true,
      audioAssetId: true,
      audioAsset: { select: { durationSeconds: true } },
      content: true,
    },
  });

  if (!record) return { ok: false, reason: "not_found" };

  const isAdmin = user?.role === "ADMIN";
  if (record.status !== "PUBLISHED" && !isAdmin) return { ok: false, reason: "not_found" };
  if (!user) return { ok: false, reason: "not_signed_in" };
  if (!canAccessTest(user, record)) return { ok: false, reason: "premium_required" };

  // A listening test with no uploaded audio cannot be sat, even by an admin
  // previewing it; silence would just look like a bug.
  if (record.skill === "LISTENING" && !record.audioAssetId) {
    return { ok: false, reason: "unavailable" };
  }

  const parsed = testContentSchema.safeParse(record.content);
  if (!parsed.success) return { ok: false, reason: "unavailable" };

  return {
    ok: true,
    test: {
      id: record.id,
      slug: record.slug,
      title: record.title,
      skill: parsed.data.skill,
      isPremium: record.isPremium,
      durationSeconds: record.durationSeconds,
      totalQuestions: record.totalQuestions,
      hasAudio: Boolean(record.audioAssetId),
      audioDurationSeconds: record.audioAsset?.durationSeconds ?? null,
      content: parsed.data,
    },
  };
}

export type TestAudio = {
  id: string;
  filename: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
};

/**
 * The audio behind a test, subject to the same gate as sitting it. Deliberately
 * does not parse the content JSON: a browser issues a range request for every
 * seek, and re-validating a 40-question test each time would be wasted work.
 */
export async function getTestAudio(
  testId: string,
  user: SessionUser | null,
): Promise<{ ok: true; audio: TestAudio } | { ok: false; reason: AccessDenial }> {
  const record = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      isPremium: true,
      status: true,
      audioAsset: {
        select: {
          id: true,
          filename: true,
          storageKey: true,
          mimeType: true,
          sizeBytes: true,
          durationSeconds: true,
        },
      },
    },
  });

  if (!record) return { ok: false, reason: "not_found" };

  const isAdmin = user?.role === "ADMIN";
  if (record.status !== "PUBLISHED" && !isAdmin) return { ok: false, reason: "not_found" };
  if (!user) return { ok: false, reason: "not_signed_in" };
  if (!canAccessTest(user, record)) return { ok: false, reason: "premium_required" };
  if (!record.audioAsset) return { ok: false, reason: "unavailable" };

  return { ok: true, audio: record.audioAsset };
}

/** Server-only. Never call this from a component or return its value to a client. */
export async function getAnswerKey(
  testId: string,
): Promise<{ content: TestContent; answerKey: TestAnswerKey } | null> {
  const record = await prisma.test.findUnique({
    where: { id: testId },
    select: { content: true, answerKey: true },
  });
  if (!record) return null;

  const content = testContentSchema.safeParse(record.content);
  const answerKey = testAnswerKeySchema.safeParse(record.answerKey);
  if (!content.success || !answerKey.success) return null;

  return { content: content.data, answerKey: answerKey.data };
}
