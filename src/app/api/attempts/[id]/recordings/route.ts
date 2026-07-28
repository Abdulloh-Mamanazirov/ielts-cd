import { randomUUID } from "node:crypto";

import { requireUserApi } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { isExpired } from "@/lib/attempts/service";
import { deleteMediaFile, RECORDING_PREFIX, writeMediaFile } from "@/lib/media/storage";

/**
 * Receives one answer from the speaking test. Each prompt is uploaded as it is
 * recorded rather than all at once at the end, so a browser crash halfway
 * through a test costs one answer instead of the whole sitting.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Two minutes of Opus is well under a megabyte; this is a generous ceiling. */
const MAX_BYTES = 25 * 1024 * 1024;

/** Container to extension. Browsers disagree: Chrome gives WebM, Safari MP4. */
const EXTENSIONS: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
};

function extensionFor(mimeType: string): string | null {
  // MediaRecorder reports things like `audio/webm;codecs=opus`.
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return EXTENSIONS[base] ?? null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  const attempt = await prisma.attempt.findFirst({
    where: { id, userId: auth.user.id },
    select: { id: true, status: true, expiresAt: true, test: { select: { skill: true } } },
  });

  if (!attempt) return Response.json({ error: "Attempt not found" }, { status: 404 });
  if (attempt.test.skill !== "SPEAKING") {
    return Response.json({ error: "This test does not take recordings" }, { status: 409 });
  }
  if (attempt.status !== "IN_PROGRESS") {
    return Response.json({ error: "This attempt has already been submitted" }, { status: 409 });
  }
  if (isExpired(attempt.expiresAt)) {
    return Response.json({ error: "Time is up", expired: true }, { status: 409 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const audio = form.get("audio");
  const part = Number(form.get("part"));
  const promptIndex = Number(form.get("promptIndex"));
  const durationSeconds = Number(form.get("durationSeconds"));

  if (!(audio instanceof File)) {
    return Response.json({ error: "No audio file" }, { status: 422 });
  }
  if (!Number.isInteger(part) || part < 1 || part > 3) {
    return Response.json({ error: "part must be 1, 2 or 3" }, { status: 422 });
  }
  if (!Number.isInteger(promptIndex) || promptIndex < 0) {
    return Response.json({ error: "promptIndex must be a non-negative integer" }, { status: 422 });
  }
  if (audio.size === 0) return Response.json({ error: "Recording is empty" }, { status: 422 });
  if (audio.size > MAX_BYTES) {
    return Response.json({ error: "Recording is too large" }, { status: 413 });
  }

  const extension = extensionFor(audio.type);
  if (!extension) {
    return Response.json({ error: `Unsupported audio type "${audio.type}"` }, { status: 415 });
  }

  const storageKey = `${RECORDING_PREFIX}/${attempt.id}/p${part}-${promptIndex}-${randomUUID()}${extension}`;
  await writeMediaFile(storageKey, new Uint8Array(await audio.arrayBuffer()));

  // Re-recording in practice replaces the previous take rather than stacking
  // them up, so the instructor is never guessing which one to mark.
  const previous = await prisma.speakingRecording.findFirst({
    where: { attemptId: attempt.id, part, promptIndex },
    select: { id: true, storageKey: true },
  });

  const recording = await prisma.speakingRecording.create({
    data: {
      attemptId: attempt.id,
      part,
      promptIndex,
      storageKey,
      mimeType: audio.type.split(";")[0].trim().toLowerCase(),
      sizeBytes: audio.size,
      durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null,
    },
    select: { id: true, part: true, promptIndex: true, durationSeconds: true },
  });

  if (previous) {
    await prisma.speakingRecording.delete({ where: { id: previous.id } }).catch(() => {});
    await deleteMediaFile(previous.storageKey).catch(() => {});
  }

  return Response.json({ recording }, { status: 201 });
}
