import { open } from "node:fs/promises";

/**
 * Duration of an MP3, without shelling out to ffmpeg.
 *
 * The player does not need this — the browser reports duration once metadata
 * loads — but storing it lets a test list say "38 min" before anything is
 * fetched, and lets the upload script sanity-check what it just copied.
 *
 * Reads the Xing/Info or VBRI header in the first frame when present, which is
 * exact for variable bitrate. Falls back to size ÷ bitrate, which is exact for
 * constant bitrate and approximate otherwise. Returns null rather than guessing
 * when the file does not parse.
 */

// Layer III bitrates in kbit/s, indexed by the 4-bit header field.
const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const BITRATES_V1_L2 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0];
const BITRATES_V1_L1 = [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0];

const SAMPLE_RATES_V1 = [44100, 48000, 32000, 0];
const SAMPLE_RATES_V2 = [22050, 24000, 16000, 0];
const SAMPLE_RATES_V25 = [11025, 12000, 8000, 0];

/** How far past the ID3 tag to hunt for the first frame sync. */
const SCAN_BYTES = 8192;

type FrameHeader = {
  offset: number;
  mpegVersion: 1 | 2 | 2.5;
  layer: 1 | 2 | 3;
  bitrateKbps: number;
  sampleRate: number;
  samplesPerFrame: number;
  channelMode: number;
};

export async function mp3DurationSeconds(path: string): Promise<number | null> {
  const handle = await open(path, "r");
  try {
    const size = (await handle.stat()).size;

    const head = Buffer.alloc(10);
    await handle.read(head, 0, 10, 0);
    const audioStart = id3v2Length(head);
    if (audioStart >= size) return null;

    const scan = Buffer.alloc(Math.min(SCAN_BYTES, size - audioStart));
    await handle.read(scan, 0, scan.length, audioStart);

    const frame = findFrame(scan);
    if (!frame) return null;

    const framed = vbrFrameCount(scan, frame);
    if (framed !== null && framed > 0) {
      return Math.round((framed * frame.samplesPerFrame) / frame.sampleRate);
    }

    // Constant bitrate: whatever is left after the tags, at the frame's rate.
    const audioBytes = size - audioStart - (await id3v1Length(handle, size));
    if (audioBytes <= 0 || frame.bitrateKbps <= 0) return null;
    return Math.round((audioBytes * 8) / (frame.bitrateKbps * 1000));
  } catch {
    return null;
  } finally {
    await handle.close();
  }
}

/** Byte length of a leading ID3v2 tag, or 0 when there is none. */
function id3v2Length(head: Buffer): number {
  if (head.length < 10) return 0;
  if (head.toString("latin1", 0, 3) !== "ID3") return 0;

  // Syncsafe: seven bits per byte, so a size can never contain a false sync.
  const size =
    ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
  const hasFooter = (head[5] & 0x10) !== 0;
  return 10 + size + (hasFooter ? 10 : 0);
}

/** Trailing ID3v1 tags are a fixed 128 bytes and must not count as audio. */
async function id3v1Length(
  handle: Awaited<ReturnType<typeof open>>,
  size: number,
): Promise<number> {
  if (size < 128) return 0;
  const tail = Buffer.alloc(3);
  await handle.read(tail, 0, 3, size - 128);
  return tail.toString("latin1") === "TAG" ? 128 : 0;
}

function findFrame(buffer: Buffer): FrameHeader | null {
  for (let i = 0; i + 4 <= buffer.length; i += 1) {
    if (buffer[i] !== 0xff || (buffer[i + 1] & 0xe0) !== 0xe0) continue;
    const header = parseHeader(buffer, i);
    if (header) return header;
  }
  return null;
}

function parseHeader(buffer: Buffer, offset: number): FrameHeader | null {
  const b1 = buffer[offset + 1];
  const b2 = buffer[offset + 2];
  const b3 = buffer[offset + 3];

  const versionBits = (b1 >> 3) & 0x03;
  const layerBits = (b1 >> 1) & 0x03;
  const bitrateIndex = (b2 >> 4) & 0x0f;
  const sampleRateIndex = (b2 >> 2) & 0x03;

  // 0b01 is reserved for both fields; free-format (0) and bad (15) bitrates
  // carry no length we can compute from.
  if (versionBits === 0x01 || layerBits === 0x00) return null;
  if (bitrateIndex === 0 || bitrateIndex === 0x0f || sampleRateIndex === 0x03) return null;

  const mpegVersion = versionBits === 0x03 ? 1 : versionBits === 0x02 ? 2 : 2.5;
  const layer = layerBits === 0x03 ? 1 : layerBits === 0x02 ? 2 : 3;

  const sampleRate = (
    mpegVersion === 1 ? SAMPLE_RATES_V1 : mpegVersion === 2 ? SAMPLE_RATES_V2 : SAMPLE_RATES_V25
  )[sampleRateIndex];
  if (!sampleRate) return null;

  const bitrateKbps = bitrateTable(mpegVersion, layer)[bitrateIndex];
  if (!bitrateKbps) return null;

  const samplesPerFrame =
    layer === 1 ? 384 : layer === 2 ? 1152 : mpegVersion === 1 ? 1152 : 576;

  return {
    offset,
    mpegVersion,
    layer,
    bitrateKbps,
    sampleRate,
    samplesPerFrame,
    channelMode: (b3 >> 6) & 0x03,
  };
}

function bitrateTable(mpegVersion: 1 | 2 | 2.5, layer: 1 | 2 | 3): number[] {
  if (mpegVersion !== 1) return BITRATES_V2_L3;
  if (layer === 1) return BITRATES_V1_L1;
  if (layer === 2) return BITRATES_V1_L2;
  return BITRATES_V1_L3;
}

/**
 * Frame count from a Xing/Info or VBRI header in the first frame. Both sit at a
 * fixed offset after the frame header, past the side information, whose size
 * depends on version and channel mode.
 */
function vbrFrameCount(buffer: Buffer, frame: FrameHeader): number | null {
  const mono = frame.channelMode === 0x03;
  const sideInfo = frame.mpegVersion === 1 ? (mono ? 17 : 32) : mono ? 9 : 17;

  const xing = frame.offset + 4 + sideInfo;
  if (xing + 12 <= buffer.length) {
    const magic = buffer.toString("latin1", xing, xing + 4);
    if (magic === "Xing" || magic === "Info") {
      const flags = buffer.readUInt32BE(xing + 4);
      // Bit 0 says a frame count follows; without it the header tells us nothing
      // about length and the caller should fall back to bitrate.
      if (flags & 0x01) return buffer.readUInt32BE(xing + 8);
      return null;
    }
  }

  // Fraunhofer's alternative, always 32 bytes after the header regardless of mode.
  const vbri = frame.offset + 4 + 32;
  if (vbri + 26 <= buffer.length && buffer.toString("latin1", vbri, vbri + 4) === "VBRI") {
    return buffer.readUInt32BE(vbri + 14);
  }

  return null;
}
