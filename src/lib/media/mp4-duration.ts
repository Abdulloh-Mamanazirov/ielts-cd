import { open, type FileHandle } from "node:fs/promises";

/**
 * Duration of an MP4/M4A, read from the movie header box.
 *
 * ISO base media files are a tree of length-prefixed boxes. `mvhd` inside
 * `moov` carries a timescale and a duration in those units, which is all we
 * need — no need to descend into tracks or samples. `moov` is often written
 * last, so the walk reads box headers off disk rather than buffering the file.
 */

/** Boxes that can contain `mvhd`; anything else is skipped whole. */
const CONTAINERS = new Set(["moov"]);

const MAX_BOXES = 512;

export async function mp4DurationSeconds(path: string): Promise<number | null> {
  const handle = await open(path, "r");
  try {
    const size = (await handle.stat()).size;
    const mvhd = await findBox(handle, 0, size, "mvhd", 0);
    if (!mvhd) return null;

    const header = Buffer.alloc(32);
    await handle.read(header, 0, 32, mvhd.payloadStart);

    const version = header[0];
    // v0 packs the times into 32 bits, v1 into 64. Timescale sits after the two
    // timestamps in both, and duration immediately after it.
    const timescale = version === 1 ? header.readUInt32BE(20) : header.readUInt32BE(12);
    const duration =
      version === 1 ? Number(header.readBigUInt64BE(24)) : header.readUInt32BE(16);

    if (!timescale || !duration) return null;
    // 0xFFFFFFFF is the "unknown duration" sentinel in v0 files.
    if (version !== 1 && duration === 0xffffffff) return null;

    return Math.round(duration / timescale);
  } catch {
    return null;
  } finally {
    await handle.close();
  }
}

type Box = { type: string; payloadStart: number; payloadEnd: number };

async function findBox(
  handle: FileHandle,
  start: number,
  end: number,
  wanted: string,
  depth: number,
): Promise<Box | null> {
  if (depth > 4) return null;

  let offset = start;
  for (let seen = 0; offset + 8 <= end && seen < MAX_BOXES; seen += 1) {
    const box = await readBoxHeader(handle, offset, end);
    if (!box) return null;

    if (box.type === wanted) return box;

    if (CONTAINERS.has(box.type)) {
      const found = await findBox(handle, box.payloadStart, box.payloadEnd, wanted, depth + 1);
      if (found) return found;
    }

    offset = box.payloadEnd;
  }

  return null;
}

async function readBoxHeader(
  handle: FileHandle,
  offset: number,
  limit: number,
): Promise<Box | null> {
  const header = Buffer.alloc(16);
  const { bytesRead } = await handle.read(header, 0, 16, offset);
  if (bytesRead < 8) return null;

  let size = header.readUInt32BE(0);
  const type = header.toString("latin1", 4, 8);
  let payloadStart = offset + 8;

  if (size === 1) {
    // 64-bit extended size, stored in the eight bytes after the type.
    if (bytesRead < 16) return null;
    size = Number(header.readBigUInt64BE(8));
    payloadStart = offset + 16;
  } else if (size === 0) {
    // Runs to the end of the file.
    size = limit - offset;
  }

  const payloadEnd = offset + size;
  if (size < 8 || payloadEnd > limit || payloadStart > payloadEnd) return null;

  return { type, payloadStart, payloadEnd };
}
