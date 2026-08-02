import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import type { TestImport } from "../../src/lib/tests/schema";
import { formatValidationReport, validateTestImport } from "../../src/lib/tests/validate";
import { convertBekhruzReading } from "./bekhruz-reading";
import { convertBekhruzListening } from "./bekhruz-listening";
import { writeJson } from "./lib";

/**
 * Converts the instructor's "@bekhruzposts" Volume 1 mocks — ten reading and
 * ten listening, each a self-contained HTML player — into canonical JSON, and
 * extracts each listening test's embedded base64 audio to an .mp3 the upload
 * pipeline can ingest.
 *
 *   npm run convert
 *
 * The two adapters parse structure rather than a hand-identified layout, so a
 * new Volume drops in by adding files and letting the numbers below grow.
 */

const SOURCE_DIR = "_source-tests";
const OUTPUT_DIR = "content/tests";
const MEDIA_DIR = "public/test-media";
const MEDIA_URL_BASE = "/test-media";
const SOURCE_LABEL = "@bekhruzposts, IELTS Volume 1";

/**
 * Finds "Reading Test 7 (Volume 2) …" → { volume, n, path }. The volume defaults
 * to 1 when a file does not name one, so a single-volume drop still works and a
 * new Volume converts alongside the last rather than colliding with its slugs.
 */
function sourceFiles(kind: "Reading" | "Listening"): Array<{ volume: number; n: number; path: string }> {
  return readdirSync(resolve(SOURCE_DIR))
    .filter((name) => name.endsWith(".html"))
    .map((name) => {
      const match = name.match(new RegExp(`^${kind}\\s*Test\\s*(\\d+)`, "i"));
      if (!match) return null;
      const volume = Number((name.match(/Volume\s*(\d+)/i) ?? [])[1] ?? 1);
      return { volume, n: Number(match[1]), path: resolve(SOURCE_DIR, name) };
    })
    .filter((entry): entry is { volume: number; n: number; path: string } => entry !== null)
    .sort((a, b) => a.volume - b.volume || a.n - b.n);
}

type Job = { label: string; outputName: string; run: () => TestImport };

const jobs: Job[] = [];

for (const { volume, n, path } of sourceFiles("Reading")) {
  const slug = `reading-volume-${volume}-test-${n}`;
  jobs.push({
    label: `Reading — Volume ${volume}, Test ${n}`,
    outputName: `${slug}.json`,
    run: () =>
      convertBekhruzReading(path, {
        title: `IELTS Reading — Volume ${volume}, Test ${n}`,
        slug,
        source: SOURCE_LABEL,
        durationSeconds: 3600,
        isPremium: false,
      }),
  });
}

for (const { volume, n, path } of sourceFiles("Listening")) {
  const slug = `listening-volume-${volume}-test-${n}`;
  jobs.push({
    label: `Listening — Volume ${volume}, Test ${n}`,
    outputName: `${slug}.json`,
    run: () =>
      convertBekhruzListening(
        path,
        {
          title: `IELTS Listening — Volume ${volume}, Test ${n}`,
          slug,
          source: SOURCE_LABEL,
          durationSeconds: 1800,
          isPremium: false,
        },
        { audioPath: resolve(SOURCE_DIR, `${slug}.mp3`), mediaDir: MEDIA_DIR, mediaUrlBase: MEDIA_URL_BASE },
      ),
  });
}

let failures = 0;

for (const job of jobs) {
  let imported: TestImport;
  try {
    imported = job.run();
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${job.label}\n      ${(error as Error).message}`);
    continue;
  }

  const report = validateTestImport(imported);
  console.log(formatValidationReport(report, job.label));

  if (report.ok) {
    const path = writeJson(`${OUTPUT_DIR}/${job.outputName}`, imported);
    console.log(`      wrote ${path}`);
  } else {
    failures += 1;
  }
  console.log("");
}

if (jobs.length === 0) {
  console.error(`No source tests found in ${SOURCE_DIR}.`);
  process.exit(1);
}

if (failures > 0) {
  console.error(`${failures} of ${jobs.length} conversions failed validation.`);
  process.exit(1);
}

console.log(
  `${jobs.length} conversion(s) passed validation. ` +
    `Listening audio was extracted to ${SOURCE_DIR}/*.mp3 — ` +
    `run \`npm run db:seed\`, then \`npm run audio:upload -- --all --publish\`.`,
);
