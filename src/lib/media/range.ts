/**
 * HTTP Range parsing for media responses.
 *
 * Audio elements lean on ranges hard: Chrome opens with `bytes=0-`, then issues
 * a fresh request from a byte offset for every seek, and Safari will not show a
 * duration at all unless 206 responses come back correctly. Kept separate from
 * the route so the arithmetic can be tested without a request.
 */

export type ParsedRange =
  | { kind: "full" }
  | { kind: "range"; start: number; end: number }
  /** Asked for bytes past the end — RFC 9110 says answer 416, not 200. */
  | { kind: "unsatisfiable" };

const BYTES_RANGE = /^bytes=(\d*)-(\d*)$/;

export function parseRangeHeader(header: string | null | undefined, size: number): ParsedRange {
  if (!header) return { kind: "full" };

  const trimmed = header.trim();

  // Multipart ranges would need a multipart/byteranges body. No media player
  // asks for them, so serving the whole file is a correct, simpler answer.
  if (trimmed.includes(",")) return { kind: "full" };

  const match = BYTES_RANGE.exec(trimmed);
  if (!match) return { kind: "full" };

  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return { kind: "full" };
  if (size <= 0) return { kind: "unsatisfiable" };

  // `bytes=-500` means the last 500 bytes, not "up to byte 500".
  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { kind: "unsatisfiable" };
    return { kind: "range", start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(rawStart);
  if (!Number.isSafeInteger(start) || start >= size) return { kind: "unsatisfiable" };

  if (rawEnd === "") return { kind: "range", start, end: size - 1 };

  const end = Number(rawEnd);
  if (!Number.isSafeInteger(end) || end < start) return { kind: "unsatisfiable" };

  return { kind: "range", start, end: Math.min(end, size - 1) };
}

export function contentRange(start: number, end: number, size: number): string {
  return `bytes ${start}-${end}/${size}`;
}
