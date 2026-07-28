import { resolve } from "node:path";

import type { TestImport } from "../../src/lib/tests/schema";
import { formatValidationReport, validateTestImport } from "../../src/lib/tests/validate";
import { convertCambridgeListening } from "./cambridge-listening";
import { convertCambridgeReading } from "./cambridge-reading";
import { convertGiraffesReading } from "./giraffes-reading";
import { convertMockListening } from "./mock-listening";
import { convertSafarovListening } from "./safarov-listening";
import { writeJson } from "./lib";

/**
 * Converts the instructor's existing HTML mocks into canonical JSON, validates
 * each one, and writes the passes to content/tests/ ready for admin import.
 *
 * Run with: npm run convert
 */

const SOURCE_DIR = "_source-tests";
const OUTPUT_DIR = "content/tests";

type Job = {
  label: string;
  outputName: string;
  run: () => TestImport;
};

const jobs: Job[] = [
  {
    label: "Cambridge 21 Reading Test 4",
    outputName: "cambridge-21-reading-test-4.json",
    run: () =>
      convertCambridgeReading(resolve(SOURCE_DIR, "Cambridge 21 Reading Test 4.html"), {
        title: "Cambridge 21 Reading Test 4",
        source: "Cambridge IELTS 21, Academic Reading Test 4",
        durationSeconds: 3600,
        isPremium: true,
      }),
  },
  {
    label: "Cambridge 21 Listening Test 4",
    outputName: "cambridge-21-listening-test-4.json",
    run: () =>
      convertCambridgeListening(resolve(SOURCE_DIR, "Cambridge 21 Listening Test 4.html"), {
        title: "Cambridge 21 Listening Test 4",
        source: "Cambridge IELTS 21, Listening Test 4",
        isPremium: true,
      }),
  },
  {
    label: "CD IELTS Listening — Volume 9, Test 2",
    outputName: "cd-ielts-listening-volume-9-test-2.json",
    run: () =>
      convertSafarovListening(
        resolve(SOURCE_DIR, "CD IELTS LIstening – Volume 9, Test 2 [@safarov_english].html"),
        {
          title: "CD IELTS Listening — Volume 9, Test 2",
          source: "@safarov_english, CD IELTS Listening Volume 9",
          isPremium: true,
        },
      ),
  },
  {
    label: "IELTS CDI Listening Mock",
    outputName: "ielts-cdi-listening-mock.json",
    run: () =>
      convertMockListening(resolve(SOURCE_DIR, "Listening Mock.html"), {
        title: "IELTS CDI Listening Mock",
        source: "IELTS CDI Listening Practice",
        isPremium: true,
        // Re-hosted locally; the source hot-links archive.org.
        mapImageUrl: "/test-media/albany-fishing-map.png",
      }),
  },
  {
    label: "Giraffes Reading (single passage)",
    outputName: "giraffes-reading-passage-1.json",
    run: () =>
      convertGiraffesReading(resolve(SOURCE_DIR, "IELTS_Reading_Passage1_Giraffes_CD.html"), {
        title: "Giraffes in the Wild — Reading Passage 1",
        source: "Practice passage, single-passage format",
        durationSeconds: 1200,
        isPremium: false,
      }),
  },
];

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

if (failures > 0) {
  console.error(`${failures} of ${jobs.length} conversions failed validation.`);
  process.exit(1);
}

console.log(`${jobs.length} conversion(s) passed validation.`);
