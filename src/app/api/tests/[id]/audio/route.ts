import { getSessionUser } from "@/lib/auth/session";
import { contentRange, parseRangeHeader } from "@/lib/media/range";
import { internalRedirectFor, mediaFileSize, mediaStream } from "@/lib/media/storage";
import { getTestAudio, type AccessDenial } from "@/lib/tests/access";

/**
 * Listening audio, gated by the same rule as sitting the test. Media never
 * lives under public/: a premium mock left on a static path would be one shared
 * URL away from being ungated.
 *
 * Responses are deliberately bodiless — an <audio> element reads the status,
 * never a JSON error — so nothing here leaks whether a test exists.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DENIAL_STATUS: Record<AccessDenial, number> = {
  not_found: 404,
  not_signed_in: 401,
  premium_required: 403,
  // No audio row yet. From the audio URL's point of view that is simply absent.
  unavailable: 404,
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  const access = await getTestAudio(id, user);
  if (!access.ok) return new Response(null, { status: DENIAL_STATUS[access.reason] });

  const { audio } = access;

  const headers = new Headers({
    "Content-Type": audio.mimeType,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    // Private, never shared: every byte passed a per-user entitlement check, so
    // a proxy or CDN must not be allowed to hand it to the next person.
    "Cache-Control": "private, max-age=3600",
  });

  try {
    // Production: nginx serves the file from the internal location, so a 40 MB
    // download does not occupy a Node worker for the length of a listening test.
    // Range handling becomes nginx's job, which is why no Content-Length is set.
    const internal = internalRedirectFor(audio.storageKey);
    if (internal) {
      headers.set("X-Accel-Redirect", internal);
      return new Response(null, { status: 200, headers });
    }

    // Development: stream from Node. The size comes from the file rather than
    // the AudioAsset row, because a wrong Content-Length breaks seeking in ways
    // that look like a corrupt file.
    const size = await mediaFileSize(audio.storageKey);
    if (size === null) {
      console.error(`AudioAsset ${audio.id} is missing from disk: ${audio.storageKey}`);
      return new Response(null, { status: 404 });
    }

    const range = parseRangeHeader(request.headers.get("range"), size);

    if (range.kind === "unsatisfiable") {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }

    if (range.kind === "full") {
      headers.set("Content-Length", String(size));
      return new Response(mediaStream(audio.storageKey), { status: 200, headers });
    }

    headers.set("Content-Range", contentRange(range.start, range.end, size));
    headers.set("Content-Length", String(range.end - range.start + 1));
    return new Response(mediaStream(audio.storageKey, range), { status: 206, headers });
  } catch (error) {
    console.error(`Could not serve audio for test ${id}:`, error);
    return new Response(null, { status: 500 });
  }
}
