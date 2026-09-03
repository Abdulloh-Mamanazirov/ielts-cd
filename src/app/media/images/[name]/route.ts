import { extname } from "node:path";

import { uploadedImageFilename } from "@/lib/media/images";
import { IMAGE_PREFIX, mediaFileSize, mediaStream } from "@/lib/media/storage";

/**
 * Serves an admin-uploaded image: Task 1 charts, map diagrams, certificate
 * scans, video thumbnails.
 *
 * These are public — they are printed on the marketing pages and inside test
 * papers — but they cannot be static files under public/, because Next lists
 * that directory once at startup. A picture uploaded while the server is
 * running would be a 404 to the app until the next deploy, and `next/image`
 * fetches through the app to optimise, so the card rendered as a broken image.
 * A route is read at request time, so a new upload works immediately.
 *
 * The bytes are streamed by Node rather than handed to nginx with
 * X-Accel-Redirect, which is what the audio route does: the image optimiser
 * fetches this URL itself, and an X-Accel response reaching it directly would
 * be an empty body it cannot decode. Images are capped at 8 MB and each
 * variant is fetched once, then cached by the optimiser.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  const filename = uploadedImageFilename(`/media/images/${name}`);
  if (!filename) return new Response(null, { status: 404 });

  const contentType = CONTENT_TYPES[extname(filename).toLowerCase()];
  if (!contentType) return new Response(null, { status: 404 });

  const storageKey = `${IMAGE_PREFIX}/${filename}`;
  const size = await mediaFileSize(storageKey);
  if (size === null) return new Response(null, { status: 404 });

  return new Response(mediaStream(storageKey), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "X-Content-Type-Options": "nosniff",
      // The filename carries a random suffix and is never reused, so the bytes
      // at this URL cannot change.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
