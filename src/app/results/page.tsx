import Link from "next/link";

import { Marquee } from "@/components/marketing/Brand";
import { ResultCard, type ShowcaseResult } from "@/components/marketing/ResultCard";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import type { VideoTestimonial } from "@/components/marketing/VideoCard";
import { VideoGrid } from "@/components/marketing/VideoGrid";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Student results",
  description:
    "Every IELTS band score, review and video from students who prepared with Davronbek Nabiev.",
};

export default async function ResultsPage() {
  const [results, testimonials] = await Promise.all([
    prisma.showcaseResult.findMany({
      where: { isVisible: true },
      // The instructor's own order, the same one /admin/showcase and the home
      // page use. Sorting by band instead would silently re-shuffle it.
      orderBy: [{ displayOrder: "asc" }, { overallBand: "desc" }],
      select: {
        id: true,
        studentName: true,
        overallBand: true,
        listening: true,
        reading: true,
        writing: true,
        speaking: true,
        quoteEn: true,
        certificateUrl: true,
        testDate: true,
      },
    }),
    prisma.testimonial.findMany({
      where: { isVisible: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        studentName: true,
        rating: true,
        mediaType: true,
        mediaUrl: true,
        thumbnailUrl: true,
        caption: true,
        quoteEn: true,
      },
    }),
  ]);

  const written = testimonials.filter((item) => item.mediaType === "TEXT");
  const videos = testimonials.filter((item) => item.mediaType !== "TEXT");

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <Marquee
          items={["VERIFIED TEST REPORT FORMS", "REAL STUDENTS", "REAL BANDS", "BAND 7–9"]}
        />

        <section className="relative overflow-hidden bg-white py-14 lg:py-20">
          <div aria-hidden className="om-grid-lines absolute inset-0" />
          <div className="relative mx-auto max-w-[1440px] px-8 lg:px-14">
            <SectionHeading
              eyebrow="STUDENT RESULTS"
              level="h1"
              title={
                <>
                  Every score.
                  <br />
                  Every story.
                </>
              }
              subtitle="Band scores, Test Report Forms, written reviews and video interviews from students who prepared with these materials."
            />

            {results.length === 0 ? (
              <Empty>No results published yet.</Empty>
            ) : (
              <ul className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {results.map((result, index) => (
                  <li key={result.id}>
                    <ResultCard
                      result={result as ShowcaseResult}
                      index={index}
                      className="bg-white hover:bg-surface-alt"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {videos.length > 0 && (
          <section className="bg-surface-alt py-16 lg:py-20">
            <div className="mx-auto max-w-[1440px] px-8 lg:px-14">
              <SectionHeading
                eyebrow="ON CAMERA"
                title="In their own voice."
                subtitle="Interviews and reels recorded by students after results day."
              />
              <VideoGrid videos={videos as VideoTestimonial[]} />
            </div>
          </section>
        )}

        {written.length > 0 && (
          <section className="relative overflow-hidden bg-white py-16 lg:py-20">
            <div aria-hidden className="absolute bottom-0 left-6 top-0 w-0.5 bg-brand-blue lg:left-14" />
            <div className="relative mx-auto max-w-[1440px] px-8 lg:px-14 lg:pl-[92px]">
              <SectionHeading eyebrow="IN WRITING" title="What students say." />

              <ul className="columns-1 gap-5 sm:columns-2 lg:columns-3">
                {written.map((item) => (
                  <li key={item.id} className="mb-5 break-inside-avoid">
                    <blockquote className="group bg-surface-alt p-6 transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_28px_50px_-24px_rgba(11,17,32,.35)]">
                      <p className="text-sm text-brand-red">
                        {"★".repeat(item.rating)}
                        <span className="text-ink-faint">{"★".repeat(5 - item.rating)}</span>
                      </p>
                      <p className="mt-4 text-base leading-relaxed text-ink text-pretty">
                        {item.quoteEn}
                      </p>
                      <footer className="mt-6 border-t border-rule pt-4 text-[10px] font-bold tracking-[0.2em] text-ink-subtle">
                        {item.studentName.toUpperCase()}
                      </footer>
                    </blockquote>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="bg-ink py-16 lg:py-20">
          <div className="mx-auto max-w-[1440px] px-8 text-center lg:px-14">
            <h2 className="mx-auto max-w-[20ch] font-display text-[clamp(1.9rem,4vw,3rem)] leading-[0.95] tracking-[-0.03em] text-white">
              Your name could be on this page.
            </h2>
            <Link
              href="/tests"
              className="mt-8 inline-flex items-center gap-3 rounded-[10px] bg-brand-red-cta px-7 py-4 text-lg font-bold text-white shadow-[0_16px_30px_-12px_rgba(225,0,70,.65)] transition hover:bg-brand-red-dark"
            >
              Take a mock test
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="bg-surface-alt p-12 text-center text-sm text-ink-subtle">{children}</p>
  );
}
