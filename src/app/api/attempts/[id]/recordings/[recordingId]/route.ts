import { requireUserApi } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { contentRange, parseRangeHeader } from "@/lib/media/range";
import { internalRedirectFor, mediaFileSize, mediaStream } from "@/lib/media/storage";

/**
 * Plays back one speaking answer. Owned by the student who recorded it, or
 * readable by an admin marking it — nobody else, which is why the attempt is
 * joined rather than the recording being addressable on its own.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; recordingId: string }> },
) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  const { id, recordingId } = await context.params;

  const recording = await prisma.speakingRecording.findFirst({
    where: {
      id: recordingId,
      attemptId: id,
      // An admin marks any student's speaking; everyone else sees only their own.
      ...(auth.user.role === "ADMIN" ? {} : { attempt: { userId: auth.user.id } }),
    },
    select: { id: true, storageKey: true, mimeType: true },
  });

  if (!recording) return new Response(null, { status: 404 });

  const headers = new Headers({
    "Content-Type": recording.mimeType,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    // A student's own voice: never let a shared cache hold it.
    "Cache-Control": "private, no-store",
  });

  try {
    const internal = internalRedirectFor(recording.storageKey);
    if (internal) {
      headers.set("X-Accel-Redirect", internal);
      return new Response(null, { status: 200, headers });
    }

    const size = await mediaFileSize(recording.storageKey);
    if (size === null) {
      console.error(`Recording ${recording.id} is missing from disk: ${recording.storageKey}`);
      return new Response(null, { status: 404 });
    }

    const range = parseRangeHeader(request.headers.get("range"), size);

    if (range.kind === "unsatisfiable") {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }

    if (range.kind === "full") {
      headers.set("Content-Length", String(size));
      return new Response(mediaStream(recording.storageKey), { status: 200, headers });
    }

    headers.set("Content-Range", contentRange(range.start, range.end, size));
    headers.set("Content-Length", String(range.end - range.start + 1));
    return new Response(mediaStream(recording.storageKey, range), { status: 206, headers });
  } catch (error) {
    console.error(`Could not serve recording ${recordingId}:`, error);
    return new Response(null, { status: 500 });
  }
}
