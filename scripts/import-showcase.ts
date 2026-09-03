import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { prisma } from "../src/lib/db";

/**
 * Loads the real Test Report Forms in content/showcase-results.json into the
 * results page, in the order the file lists them.
 *
 *   npm run showcase:import           # add and update, leave anything else alone
 *   npm run showcase:import -- --prune   # also delete rows the file does not name
 *
 * Rows are matched by student name, so a re-run corrects a transcription rather
 * than adding a second card. `displayOrder` is rewritten from the file's order
 * every time, which is the whole point: the page is meant to read in the order
 * the scans were handed over, not by band.
 *
 * `--prune` is how the four placeholder students the seed writes for local
 * development get cleared off a real site. Without it nothing is deleted.
 *
 * This is a one-off import, not a seed. /admin/showcase is the editor after it
 * runs, and running this again would undo edits made there — so re-run it only
 * to correct the file itself.
 */

const FILE = "content/showcase-results.json";

type Row = {
  studentName: string;
  overallBand: number;
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  quoteEn: string | null;
  certificateUrl: string | null;
  testDate: Date | null;
};

/** Bands are reported in halves; anything else means a misread scan. */
function band(value: unknown, where: string): number {
  if (typeof value !== "number" || value < 0 || value > 9 || (value * 2) % 1 !== 0) {
    throw new Error(`${where}: ${JSON.stringify(value)} is not an IELTS band`);
  }
  return value;
}

function optionalBand(value: unknown, where: string): number | null {
  return value === null || value === undefined ? null : band(value, where);
}

function parse(): Row[] {
  const raw = JSON.parse(readFileSync(resolve(FILE), "utf8"));
  const results = raw?.results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`${FILE} has no results array`);
  }

  return results.map((entry, index) => {
    const where = `${FILE}[${index}]`;
    const studentName = String(entry.studentName ?? "").trim();
    if (!studentName) throw new Error(`${where}: no studentName`);

    const certificateUrl = entry.certificateUrl ?? null;
    if (certificateUrl) {
      // A card whose slip 404s looks worse than a card with no slip at all.
      if (!/^\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(certificateUrl) || certificateUrl.includes("..")) {
        throw new Error(`${where}: ${certificateUrl} is not a local image path`);
      }
      const onDisk = resolve("public", certificateUrl.replace(/^\//, ""));
      if (!existsSync(onDisk)) throw new Error(`${where}: ${certificateUrl} is not in public/`);
    }

    const testDate = entry.testDate ? new Date(entry.testDate) : null;
    if (testDate && Number.isNaN(testDate.getTime())) {
      throw new Error(`${where}: ${entry.testDate} is not a date`);
    }

    return {
      studentName,
      overallBand: band(entry.overallBand, `${where}.overallBand`),
      listening: optionalBand(entry.listening, `${where}.listening`),
      reading: optionalBand(entry.reading, `${where}.reading`),
      writing: optionalBand(entry.writing, `${where}.writing`),
      speaking: optionalBand(entry.speaking, `${where}.speaking`),
      quoteEn: entry.quoteEn?.trim() || null,
      certificateUrl,
      testDate,
    };
  });
}

async function main() {
  const prune = process.argv.includes("--prune");
  const rows = parse();

  const names = new Set(rows.map((row) => row.studentName));
  if (names.size !== rows.length) {
    throw new Error("two results share a student name — rows are matched by name");
  }

  let created = 0;
  let updated = 0;

  for (const [index, row] of rows.entries()) {
    const existing = await prisma.showcaseResult.findFirst({
      where: { studentName: row.studentName },
      select: { id: true },
    });

    if (existing) {
      await prisma.showcaseResult.update({
        where: { id: existing.id },
        data: { ...row, displayOrder: index, isVisible: true },
      });
      updated += 1;
      continue;
    }

    await prisma.showcaseResult.create({
      data: { ...row, displayOrder: index, isVisible: true },
    });
    created += 1;
  }

  console.log(`ok    ${created} added, ${updated} updated, in file order`);

  const others = await prisma.showcaseResult.findMany({
    where: { studentName: { notIn: [...names] } },
    select: { id: true, studentName: true },
  });

  if (others.length === 0) {
    // Nothing else in the table, so the page reads exactly like the file.
  } else if (prune) {
    await prisma.showcaseResult.deleteMany({ where: { id: { in: others.map((o) => o.id) } } });
    console.log(`ok    removed ${others.length}: ${others.map((o) => o.studentName).join(", ")}`);
  } else {
    // Pushed past the imported rows so they cannot break the file's order.
    for (const [offset, other] of others.entries()) {
      await prisma.showcaseResult.update({
        where: { id: other.id },
        data: { displayOrder: rows.length + offset },
      });
    }
    console.log(
      `note  ${others.length} other result(s) moved to the end: ` +
        `${others.map((o) => o.studentName).join(", ")} — re-run with --prune to delete them`,
    );
  }

  console.log(`ok    ${await prisma.showcaseResult.count()} showcase results total`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
