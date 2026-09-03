import { randomUUID } from "node:crypto";

import { requireAdminApi } from "@/lib/auth/guards";
import { imageUrlFor } from "@/lib/media/images";
import { IMAGE_PREFIX, writeMediaFile } from "@/lib/media/storage";

/**
 * Test artwork: writing Task 1 charts, map-labelling diagrams, certificate
 * scans and video thumbnails.
 *
 * Nothing here needs protecting — a chart carries no answers — but it still
 * goes to the media directory rather than `public/test-media/`. Next lists
 * `public/` once when the server starts, so a file written there while it runs
 * is a 404 to the app until the next deploy: the upload appeared to succeed and
 * the picture came out blank, because `next/image` optimises by fetching the
 * path back through the app. `/media/images/<file>` is a route, read per
 * request, so an upload works the moment it lands.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

/** Magic bytes, so the stored type is what the file is rather than what it claims. */
function sniff(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));

  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 3) === "GIF") return "image/gif";
  return null;
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return Response.json({ error: "No image" }, { status: 422 });
  }
  if (file.size === 0) return Response.json({ error: "That file is empty" }, { status: 422 });
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Images must be under 8 MB" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = sniff(bytes);

  // SVG has no magic number and is the one format that can carry script, so it
  // is refused rather than sniffed. A chart exports to PNG just as well.
  if (!detected) {
    return Response.json(
      { error: "Use a PNG, JPEG, WebP or GIF. SVG is not accepted." },
      { status: 415 },
    );
  }

  const slug = String(form.get("slug") ?? "image")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "image";

  const filename = `${slug}-${randomUUID().slice(0, 8)}${EXTENSIONS[detected]}`;

  try {
    await writeMediaFile(`${IMAGE_PREFIX}/${filename}`, bytes);
  } catch (error) {
    console.error(`Could not store test image ${filename}:`, error);
    return Response.json({ error: "The server could not store that image." }, { status: 500 });
  }

  return Response.json({ url: imageUrlFor(filename) }, { status: 201 });
}
