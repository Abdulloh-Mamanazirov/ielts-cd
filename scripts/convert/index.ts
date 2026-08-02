import { closeSync, openSync, readdirSync, readSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import type { TestImport } from "../../src/lib/tests/schema";
import { formatValidationReport, validateTestImport } from "../../src/lib/tests/validate";
import { convertBekhruzReading } from "./bekhruz-reading";
import { convertBekhruzListening } from "./bekhruz-listening";
import { writeJson } from "./lib";

/**
 * Converts the instructor's "@bekhruzposts" mocks — self-contained HTML players,
 * one Volume at a time — into canonical JSON, and extracts any embedded base64
 * listening audio to an .mp3 the upload pipeline can ingest.
 *
 *   npm run convert
 *
 * Sources land in `_source-tests/`, loose or in per-Volume subfolders, and are
 * named every which way. Discovery reads the skill, test number and Volume from
 * each filename AND its <title>, falling back to the subfolder name for the
 * Volume — so "Vol 8 Test 1" (whose name says neither skill nor a clean Volume)
 * and "IELTS Reading Test 9" (in a `vol9/` folder) both resolve. The adapters
 * parse structure, not a fixed layout, so a new Volume drops in by adding files.
 */

const SOURCE_DIR = "_source-tests";
const OUTPUT_DIR = "content/tests";
const MEDIA_DIR = "public/test-media";
const MEDIA_URL_BASE = "/test-media";
const SOURCE_LABEL = "@bekhruzposts";

/** Every .html under the source directory, however deeply nested. */
function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

/** The `<title>` from a file's head, without reading a 40 MB base64 body. */
function readTitle(path: string): string {
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(8192);
    const bytes = readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.toString("utf8", 0, bytes).match(/<title>([^<]*)<\/title>/i)?.[1] ?? "";
  } finally {
    closeSync(fd);
  }
}

/**
 * The Volume named in text — "(Volume 3)", "Vol 8", "Vol_3" — or, historically,
 * the "Real Exam" listening series the instructor files as Volume 4.
 */
function namedVolume(text: string): number | null {
  if (/real\s*exam/i.test(text)) return 4;
  const match = text.match(/vol(?:ume)?[\s_]*(\d+)/i);
  return match ? Number(match[1]) : null;
}

type Found = { skill: "reading" | "listening"; volume: number; n: number; path: string; slug: string };

/**
 * Resolves every source file to a skill, Volume and test number. Skill and
 * number come from the filename or the title; the Volume from either, else the
 * enclosing `volN` folder. Anything that cannot be placed, or would collide with
 * a slug already taken, is skipped with a note rather than guessed.
 */
function discover(): Found[] {
  const seen = new Set<string>();
  const found: Found[] = [];

  for (const path of htmlFiles(resolve(SOURCE_DIR))) {
    const hay = `${basename(path)} ${readTitle(path)}`;
    const skill = /listening/i.test(hay) ? "listening" : /reading/i.test(hay) ? "reading" : null;
    const test = hay.match(/(?:^|[\s_(])Test[\s_]*(\d+)/i);
    const volume = namedVolume(hay) ?? namedVolume(basename(dirname(path)));
    if (!skill || !test || volume === null) {
      console.warn(`skip  ${basename(path)} — could not read skill/volume/number`);
      continue;
    }

    const n = Number(test[1]);
    const slug = `${skill}-volume-${volume}-test-${n}`;
    if (seen.has(slug)) {
      console.warn(`skip  ${basename(path)} — ${slug} already taken`);
      continue;
    }
    seen.add(slug);
    found.push({ skill, volume, n, path, slug });
  }

  return found.sort((a, b) => a.skill.localeCompare(b.skill) || a.volume - b.volume || a.n - b.n);
}

type Job = { label: string; outputName: string; run: () => TestImport };

const jobs: Job[] = discover().map((test) => {
  const { skill, volume, n, path, slug } = test;
  const label = `${skill === "reading" ? "Reading" : "Listening"} — Volume ${volume}, Test ${n}`;

  if (skill === "reading") {
    return {
      label,
      outputName: `${slug}.json`,
      run: () =>
        convertBekhruzReading(path, {
          title: `IELTS Reading — Volume ${volume}, Test ${n}`,
          slug,
          source: SOURCE_LABEL,
          durationSeconds: 3600,
          isPremium: false,
        }),
    };
  }

  return {
    label,
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
  };
});

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
