import { open } from "node:fs/promises";

import { mp3DurationSeconds } from "./mp3-duration";
import { mp4DurationSeconds } from "./mp4-duration";

/**
 * What an audio file actually is, read from its first bytes rather than its
 * name. One of the instructor's mocks is an M4A saved with a .mp3 extension;
 * trusting that would have sent `Content-Type: audio/mpeg` alongside the
 * `nosniff` header the streaming route sets, and a strict browser would refuse
 * to play it.
 */

export type AudioFormat = "mp3" | "mp4" | "ogg" | "wav";

export type AudioProbe = {
  format: AudioFormat;
  mimeType: string;
  /** Canonical extension for the format, used for the storage key. */
  extension: string;
  durationSeconds: number | null;
};

const FORMATS: Record<AudioFormat, { mimeType: string; extension: string }> = {
  mp3: { mimeType: "audio/mpeg", extension: ".mp3" },
  mp4: { mimeType: "audio/mp4", extension: ".m4a" },
  ogg: { mimeType: "audio/ogg", extension: ".ogg" },
  wav: { mimeType: "audio/wav", extension: ".wav" },
};

export async function probeAudio(path: string): Promise<AudioProbe | null> {
  const format = await sniff(path);
  if (!format) return null;

  const durationSeconds =
    format === "mp3"
      ? await mp3DurationSeconds(path)
      : format === "mp4"
        ? await mp4DurationSeconds(path)
        : null;

  return { format, ...FORMATS[format], durationSeconds };
}

async function sniff(path: string): Promise<AudioFormat | null> {
  const handle = await open(path, "r");
  try {
    const head = Buffer.alloc(12);
    const { bytesRead } = await handle.read(head, 0, 12, 0);
    if (bytesRead < 12) return null;

    // ISO base media: a `ftyp` box always leads, after its own 4-byte length.
    if (head.toString("latin1", 4, 8) === "ftyp") return "mp4";
    if (head.toString("latin1", 0, 4) === "OggS") return "ogg";
    if (head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WAVE") {
      return "wav";
    }
    // An MP3 either opens with an ID3v2 tag or straight into a frame sync.
    if (head.toString("latin1", 0, 3) === "ID3") return "mp3";
    if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return "mp3";

    return null;
  } catch {
    return null;
  } finally {
    await handle.close();
  }
}
