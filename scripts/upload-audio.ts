import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { rename, rm, stat } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { prisma } from "../src/lib/db";
import { probeAudio, type AudioProbe } from "../src/lib/media/probe";
import {
  AUDIO_PREFIX,
  ensureMediaDir,
  mediaRoot,
  resolveMediaPath,
} from "../src/lib/media/storage";

/**
 * Puts a listening test's audio into MEDIA_STORAGE_DIR, records an AudioAsset,
 * attaches it to the test and — with --publish — makes the test visible.
 *
 * The admin panel will grow an upload form later; until then this is the only
 * way audio gets in, so it has to be safe to re-run.
 *
 *   npm run audio:upload -- --list
 *   npm run audio:upload -- --test <slug> --file "_source-tests/Listening Mock.mp3" --publish
 *   npm run audio:upload -- --test <slug> --from-source --publish
 */

type Options = {
  list: boolean;
  all: boolean;
  slug?: string;
  file?: string;
  fromSource: boolean;
  publish: boolean;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { list: false, all: false, fromSource: false, publish: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") options.list = true;
    else if (arg === "--all") options.all = true;
    else if (arg === "--from-source") options.fromSource = true;
    else if (arg === "--publish") options.publish = true;
    else if (arg === "--test") options.slug = argv[++i];
    else if (arg === "--file") options.file = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

const SOURCE_DIR = "_source-tests";

/**
 * Attaches every listening test that has audio to ingest — an extracted
 * `_source-tests/<slug>.mp3` (from a base64 source) when one is present, and
 * otherwise a download from its recorded `audioSourceUrl` (an externally hosted
 * source). One command to release a whole Volume after converting.
 */
async function uploadAll(options: Options) {
  const tests = await prisma.test.findMany({
    where: { skill: "LISTENING" },
    select: { slug: true, audioSourceUrl: true },
    orderBy: { slug: "asc" },
  });

  let done = 0;
  let skipped = 0;
  for (const test of tests) {
    const file = resolvePath(SOURCE_DIR, `${test.slug}.mp3`);
    let hasFile = false;
    try {
      await stat(file);
      hasFile = true;
    } catch {
      hasFile = false;
    }

    if (hasFile) {
      await upload({ ...options, slug: test.slug, file, fromSource: false });
    } else if (test.audioSourceUrl) {
      await upload({ ...options, slug: test.slug, file: undefined, fromSource: true });
    } else {
      console.log(`skip  ${test.slug} — no ${SOURCE_DIR}/${test.slug}.mp3 and no source URL`);
      skipped += 1;
      continue;
    }
    console.log("");
    done += 1;
  }
  console.log(`ok    attached ${done} listening test(s)${skipped ? `, skipped ${skipped}` : ""}.`);
}

async function listTests() {
  const tests = await prisma.test.findMany({
    where: { skill: "LISTENING" },
    select: {
      slug: true,
      title: true,
      status: true,
      audioSourceUrl: true,
      audioAsset: {
        select: { filename: true, mimeType: true, sizeBytes: true, durationSeconds: true },
      },
    },
    orderBy: { slug: "asc" },
  });

  if (tests.length === 0) {
    console.log("No listening tests. Run `npm run convert` then `npm run db:seed`.");
    return;
  }

  for (const test of tests) {
    const asset = test.audioAsset;
    const audio = asset
      ? `${asset.filename} — ${asset.mimeType}, ${formatMb(asset.sizeBytes)}` +
        `${asset.durationSeconds ? `, ${formatDuration(asset.durationSeconds)}` : ", duration unknown"}`
      : "— no audio";
    console.log(`${test.status.padEnd(9)} ${test.slug}`);
    console.log(`          ${test.title}`);
    console.log(`          audio: ${audio}`);
    if (!asset && test.audioSourceUrl) {
      console.log(`          source: ${test.audioSourceUrl}`);
    }
    console.log("");
  }
}

/**
 * Streams bytes into the media directory, hashing as it goes, then identifies
 * what actually landed. The name a file arrives under decides nothing: one of
 * the instructor's mocks is an M4A called .mp3, and serving that as audio/mpeg
 * would be a bug the streaming route's `nosniff` header turns into silence.
 */
async function ingest(
  source: NodeJS.ReadableStream,
  slug: string,
): Promise<{ storageKey: string; sizeBytes: number; probe: AudioProbe }> {
  // Written under a random name first, so an interrupted transfer never leaves
  // a truncated file sitting at the key a test points at.
  const tempKey = `${AUDIO_PREFIX}/incoming-${randomUUID()}.tmp`;
  await ensureMediaDir(tempKey);
  const tempPath = resolveMediaPath(tempKey);

  const hash = createHash("sha256");
  let sizeBytes = 0;

  try {
    await pipeline(
      source,
      async function* (chunks: AsyncIterable<string | Buffer>) {
        for await (const chunk of chunks) {
          const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
          hash.update(bytes);
          sizeBytes += bytes.length;
          yield bytes;
        }
      },
      createWriteStream(tempPath),
    );

    if (sizeBytes === 0) throw new Error("Read 0 bytes");

    const probe = await probeAudio(tempPath);
    if (!probe) {
      throw new Error("Not a recognised audio file (expected MP3, M4A/MP4, Ogg or WAV)");
    }

    // Content-addressed suffix: re-uploading the same file lands on the same
    // key rather than accumulating copies of a 50 MB mock.
    const digest = hash.digest("hex").slice(0, 12);
    const storageKey = `${AUDIO_PREFIX}/${slug}-${digest}${probe.extension}`;
    await rename(tempPath, resolveMediaPath(storageKey));

    return { storageKey, sizeBytes, probe };
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

async function openSource(
  options: Options,
  test: { slug: string; audioSourceUrl: string | null },
): Promise<{ stream: NodeJS.ReadableStream; filename: string }> {
  if (options.file) {
    const path = resolvePath(options.file);
    const info = await stat(path);
    if (!info.isFile()) throw new Error(`Not a file: ${path}`);

    console.log(`      reading ${path} (${formatMb(info.size)})`);
    return { stream: createReadStream(path), filename: basename(path) };
  }

  if (!test.audioSourceUrl) {
    throw new Error(`${test.slug} has no audioSourceUrl to download from — pass --file instead`);
  }

  const url = new URL(test.audioSourceUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Refusing to download from ${url.protocol}`);
  }

  console.log(`      downloading ${url.href}`);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  return {
    stream: Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    filename: decodeURIComponent(basename(url.pathname)) || test.slug,
  };
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/**
 * Drops the file and row a test used to point at, once nothing references them.
 * Without this, every re-upload strands another 50 MB on disk.
 */
async function discardSuperseded(previousId: string | null, currentId: string) {
  if (!previousId || previousId === currentId) return;

  const stillUsed = await prisma.test.count({ where: { audioAssetId: previousId } });
  if (stillUsed > 0) return;

  const previous = await prisma.audioAsset.findUnique({
    where: { id: previousId },
    select: { storageKey: true },
  });
  if (!previous) return;

  await prisma.audioAsset.delete({ where: { id: previousId } });
  await rm(resolveMediaPath(previous.storageKey), { force: true });
  console.log(`ok    removed superseded ${previous.storageKey}`);
}

async function upload(options: Options) {
  if (!options.slug) throw new Error("--test <slug> is required");
  if (!options.file && !options.fromSource) {
    throw new Error("Pass either --file <path> or --from-source");
  }

  const test = await prisma.test.findUnique({
    where: { slug: options.slug },
    select: {
      id: true,
      slug: true,
      title: true,
      skill: true,
      status: true,
      audioSourceUrl: true,
      audioAssetId: true,
    },
  });

  if (!test) throw new Error(`No test with slug "${options.slug}"`);
  if (test.skill !== "LISTENING") {
    throw new Error(`${test.slug} is a ${test.skill.toLowerCase()} test — it has no audio`);
  }

  console.log(`ok    ${test.title}`);
  console.log(`      media root ${mediaRoot()}`);

  const { stream, filename } = await openSource(options, test);
  const { storageKey, sizeBytes, probe } = await ingest(stream, test.slug);

  console.log(
    `      stored ${storageKey} — ${probe.mimeType}, ${formatMb(sizeBytes)}` +
      `${probe.durationSeconds ? `, ${formatDuration(probe.durationSeconds)}` : ", duration unknown"}`,
  );

  const asset = await prisma.audioAsset.upsert({
    where: { storageKey },
    update: {
      filename,
      mimeType: probe.mimeType,
      sizeBytes,
      durationSeconds: probe.durationSeconds,
    },
    create: {
      filename,
      storageKey,
      mimeType: probe.mimeType,
      sizeBytes,
      durationSeconds: probe.durationSeconds,
    },
  });

  await prisma.test.update({ where: { id: test.id }, data: { audioAssetId: asset.id } });
  console.log(`ok    attached AudioAsset ${asset.id}`);

  await discardSuperseded(test.audioAssetId, asset.id);

  if (!options.publish) {
    console.log(`      still ${test.status.toLowerCase()} — re-run with --publish to release it`);
    return;
  }

  if (test.status === "PUBLISHED") {
    console.log("ok    already published");
    return;
  }

  await prisma.test.update({
    where: { id: test.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  console.log("ok    published");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) return listTests();
  if (options.all) return uploadAll(options);
  return upload(options);
}

main()
  .catch((error) => {
    console.error(`FAIL  ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
