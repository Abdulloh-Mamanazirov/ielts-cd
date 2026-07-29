import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { validateTestImport } from "../src/lib/tests/validate";

/**
 * Idempotent seed: an admin account, every validated test in content/tests, and
 * a little homepage content to develop against. Safe to re-run.
 *
 *   npm run db:seed
 */

const CONTENT_DIR = "content/tests";

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  const fullName = process.env.SEED_ADMIN_NAME ?? "Administrator";

  if (!email || !password) {
    console.log("skip  admin (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one)");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    // Never silently reset a password that may have been changed since.
    await prisma.user.update({ where: { email }, data: { role: "ADMIN", isPremium: true } });
    console.log(`ok    admin ${email} already existed, role confirmed`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      isPremium: true,
    },
  });
  console.log(`ok    admin ${email} created`);
}

async function seedTests() {
  let files: string[];
  try {
    files = readdirSync(resolve(CONTENT_DIR)).filter((name) => name.endsWith(".json"));
  } catch {
    console.log("skip  tests (run `npm run convert` first)");
    return;
  }

  for (const file of files) {
    const raw = JSON.parse(readFileSync(resolve(CONTENT_DIR, file), "utf8"));
    const report = validateTestImport(raw);

    if (!report.ok || !report.parsed) {
      const first = report.issues.find((issue) => issue.level === "error");
      console.log(`FAIL  ${file}: ${first?.message ?? "failed validation"}`);
      continue;
    }

    const { content, answerKey, slug, isPremium, audioSourceUrl } = report.parsed;
    const skill = content.skill.toUpperCase() as "LISTENING" | "READING" | "WRITING" | "SPEAKING";

    // A listening test has no audio until someone uploads it, and an unplayable
    // test must never be visible to students.
    const publishable = skill !== "LISTENING";

    const existing = await prisma.test.findUnique({
      where: { slug: slug ?? file.replace(/\.json$/, "") },
      select: { id: true, audioAssetId: true, status: true },
    });

    const data = {
      skill,
      title: content.title,
      description: content.description ?? null,
      isPremium: isPremium ?? false,
      schemaVersion: content.schemaVersion,
      content,
      answerKey,
      totalQuestions: content.totalQuestions,
      durationSeconds: content.durationSeconds,
      source: content.source ?? null,
      audioSourceUrl: audioSourceUrl ?? null,
    };

    if (existing) {
      await prisma.test.update({ where: { id: existing.id }, data });
      console.log(`ok    updated ${content.title} (${existing.status.toLowerCase()})`);
      continue;
    }

    const status = publishable ? ("PUBLISHED" as const) : ("DRAFT" as const);
    await prisma.test.create({
      data: {
        ...data,
        slug: slug ?? file.replace(/\.json$/, ""),
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
    });
    console.log(
      `ok    created ${content.title} [${status.toLowerCase()}]` +
        (audioSourceUrl ? " — needs audio upload before publishing" : ""),
    );
  }
}

/**
 * Placeholder marketing content, so the home page has something to render
 * during development. Replace it with real students in `/admin/showcase`.
 *
 * Written only into a database that has none. These rows used to be upserted by
 * student name on every run, which was fine while the seed was the only way to
 * edit them; it is not any more, and re-running it after launch would quietly
 * undo the instructor's own wording, ordering and certificates.
 */
async function seedHomepageContent() {
  const [existingResults, existingTestimonials] = await Promise.all([
    prisma.showcaseResult.count(),
    prisma.testimonial.count(),
  ]);

  if (existingResults > 0 || existingTestimonials > 0) {
    console.log(
      `skip  home page content (${existingResults} results, ${existingTestimonials} reviews already there — edit them in /admin/showcase)`,
    );
    return;
  }

  const results = [
    {
      studentName: "Malika A.",
      overallBand: 8.5,
      listening: 9,
      reading: 9,
      writing: 7.5,
      speaking: 8,
      quoteEn: "The strategies and feedback helped me reach my target much faster than I expected.",
      certificateUrl: "/ielts-certificate-sample.jpg",
      testDate: new Date("2026-03-23"),
    },
    {
      studentName: "Asadbek T.",
      overallBand: 8,
      listening: 8.5,
      reading: 8.5,
      writing: 7,
      speaking: 8,
      quoteEn: "The mock tests were so similar to the real exam that test day felt familiar.",
      certificateUrl: "/ielts-certificate-sample.jpg",
      testDate: new Date("2026-01-18"),
    },
    {
      studentName: "Sevinch M.",
      overallBand: 7.5,
      listening: 8.5,
      reading: 7.5,
      writing: 6.5,
      speaking: 7.5,
      quoteEn: "I improved my weak areas and got the band I needed for my university.",
      certificateUrl: "/ielts-certificate-sample.jpg",
      testDate: new Date("2025-11-08"),
    },
    {
      studentName: "Behruz K.",
      overallBand: 8,
      listening: 8.5,
      reading: 8,
      writing: 7,
      speaking: 8,
      quoteEn: "Professional approach, detailed feedback and constant support throughout.",
      certificateUrl: "/ielts-certificate-sample.jpg",
      testDate: new Date("2026-02-14"),
    },
  ];

  for (const [index, result] of results.entries()) {
    const existing = await prisma.showcaseResult.findFirst({
      where: { studentName: result.studentName },
      select: { id: true },
    });
    if (existing) {
      await prisma.showcaseResult.update({ where: { id: existing.id }, data: result });
      continue;
    }
    await prisma.showcaseResult.create({ data: { ...result, displayOrder: index } });
  }

  const testimonials = [
    {
      studentName: "Shakhzoda",
      rating: 5,
      mediaType: "TEXT" as const,
      quoteEn: "I went from 6.0 to 8.0 in just three months. Thank you so much!",
    },
    {
      studentName: "Diyorbek",
      rating: 5,
      mediaType: "TEXT" as const,
      quoteEn: "His feedback on writing and speaking is unbelievable. Really effective.",
    },
    {
      studentName: "Madina",
      rating: 5,
      mediaType: "TEXT" as const,
      quoteEn: "The best IELTS teacher I have ever met.",
    },
    {
      studentName: "Azizbek",
      rating: 5,
      mediaType: "TEXT" as const,
      quoteEn: "Mock tests here are just like the real exam. Very helpful.",
    },
    {
      studentName: "Student interview",
      rating: 5,
      mediaType: "YOUTUBE" as const,
      mediaUrl: "https://youtu.be/VE5ChGlD8s4",
      caption: "How I prepared and what changed my score",
      quoteEn: null,
    },
    {
      studentName: "Results day reel",
      rating: 5,
      mediaType: "INSTAGRAM" as const,
      mediaUrl: "https://www.instagram.com/reel/Daw8sE7K6wJ/",
      caption: "Opening the Test Report Form",
      quoteEn: null,
    },
    {
      studentName: "Speaking practice reel",
      rating: 5,
      mediaType: "INSTAGRAM" as const,
      mediaUrl: "https://www.instagram.com/reel/DapFzTuthgI/",
      caption: "Part 2 cue card, unrehearsed",
      quoteEn: null,
    },
    {
      studentName: "Student story",
      rating: 5,
      mediaType: "INSTAGRAM" as const,
      mediaUrl: "https://www.instagram.com/reel/DXrsZMnDNTw/",
      caption: "From 6.0 to 7.5 in three months",
      quoteEn: null,
    },
  ];

  for (const [index, testimonial] of testimonials.entries()) {
    const existing = await prisma.testimonial.findFirst({
      where: { studentName: testimonial.studentName },
      select: { id: true },
    });
    if (existing) {
      await prisma.testimonial.update({ where: { id: existing.id }, data: testimonial });
      continue;
    }
    await prisma.testimonial.create({ data: { ...testimonial, displayOrder: index } });
  }

  console.log(
    `ok    ${await prisma.showcaseResult.count()} showcase results, ` +
      `${await prisma.testimonial.count()} testimonials`,
  );
}

async function main() {
  await seedAdmin();
  await seedTests();
  await seedHomepageContent();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
