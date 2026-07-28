import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";

/**
 * Uploaded media — listening audio today, speaking recordings later — lives
 * outside the web root and is only ever reachable through an authenticated
 * route. Nothing here trusts a storage key blindly: keys come from the database,
 * but a single bad row must not turn into arbitrary file reads.
 */

/** Subdirectories under the media root, so audio and recordings stay separable. */
export const AUDIO_PREFIX = "audio";
export const RECORDING_PREFIX = "recordings";

/**
 * One path segment: starts alphanumeric, then word characters, dots or hyphens.
 * `.` and `..` cannot match, which is what keeps traversal out.
 */
const SEGMENT = /^[a-z0-9][a-z0-9._-]*$/i;

export class MediaError extends Error {}

export function mediaRoot(): string {
  const dir = process.env.MEDIA_STORAGE_DIR?.trim();
  if (!dir) {
    throw new MediaError("MEDIA_STORAGE_DIR is not set. Copy .env.example to .env first.");
  }
  return resolve(dir);
}

export function isValidStorageKey(key: string): boolean {
  if (!key || key.length > 200) return false;
  // Backslashes would be a separator on Windows but pass a POSIX-only check.
  if (key.includes("\\")) return false;
  const segments = key.split("/");
  if (segments.length < 1 || segments.length > 4) return false;
  return segments.every((segment) => SEGMENT.test(segment));
}

/**
 * Absolute path for a storage key, guaranteed to sit inside the media root.
 * The containment check is deliberately kept even though the key pattern
 * already forbids traversal — two independent checks, because the cost of
 * getting this wrong is reading anything on the disk.
 */
export function resolveMediaPath(storageKey: string): string {
  if (!isValidStorageKey(storageKey)) {
    throw new MediaError(`Refusing to resolve unsafe storage key: ${JSON.stringify(storageKey)}`);
  }

  const root = mediaRoot();
  const full = resolve(root, storageKey);

  if (full !== root && !full.startsWith(root + sep)) {
    throw new MediaError(`Storage key escapes the media root: ${JSON.stringify(storageKey)}`);
  }

  return full;
}

export async function mediaFileSize(storageKey: string): Promise<number | null> {
  try {
    const info = await stat(resolveMediaPath(storageKey));
    return info.isFile() ? info.size : null;
  } catch {
    return null;
  }
}

export async function ensureMediaDir(storageKey: string): Promise<void> {
  await mkdir(dirname(resolveMediaPath(storageKey)), { recursive: true });
}

/** Whole-file write, for uploads small enough to hold in memory (recordings). */
export async function writeMediaFile(storageKey: string, data: Uint8Array): Promise<void> {
  await ensureMediaDir(storageKey);
  await writeFile(resolveMediaPath(storageKey), data);
}

export async function deleteMediaFile(storageKey: string): Promise<void> {
  await rm(resolveMediaPath(storageKey), { force: true });
}

/**
 * In production nginx serves the bytes: the route still runs, so authentication
 * and entitlement are enforced, but it hands the file off with X-Accel-Redirect
 * instead of pumping 40 MB through Node. Returns null in development, where the
 * prefix is empty and Node streams the file itself.
 */
export function internalRedirectFor(storageKey: string): string | null {
  const prefix = process.env.MEDIA_INTERNAL_PREFIX?.trim();
  if (!prefix) return null;
  if (!isValidStorageKey(storageKey)) {
    throw new MediaError(`Refusing to redirect unsafe storage key: ${JSON.stringify(storageKey)}`);
  }
  return `/${prefix.replace(/^\/+|\/+$/g, "")}/${storageKey}`;
}

/**
 * A byte range of a stored file as a web stream, for a 206 response. Node
 * destroys the underlying handle when the client disconnects mid-download,
 * which is the normal case for audio the student does not listen to the end of.
 */
export function mediaStream(
  storageKey: string,
  range?: { start: number; end: number },
): ReadableStream<Uint8Array> {
  const node = createReadStream(resolveMediaPath(storageKey), range);
  return Readable.toWeb(node) as ReadableStream<Uint8Array>;
}
