import { Hero } from "@/components/marketing/Hero";
import { MobileCtaBar } from "@/components/marketing/MobileCtaBar";
import { PracticeSection } from "@/components/marketing/PracticeSection";
import { ResultsSection, type ShowcaseResult } from "@/components/marketing/ResultsSection";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { TestimonialsSection, type Testimonial } from "@/components/marketing/TestimonialsSection";
import { WhySection } from "@/components/marketing/WhySection";
import { prisma } from "@/lib/db";

const HOME_RESULTS = 8;
const HOME_TESTIMONIALS = 8;

export default async function HomePage() {
  const [results, testimonials, testsBySkill] = await Promise.all([
    prisma.showcaseResult.findMany({
      where: { isVisible: true },
      orderBy: [{ displayOrder: "asc" }, { overallBand: "desc" }],
      take: HOME_RESULTS,
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
      take: HOME_TESTIMONIALS,
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
    prisma.test.groupBy({
      by: ["skill"],
      where: { status: "PUBLISHED" },
      _count: { _all: true },
    }),
  ]);

  const counts = Object.fromEntries(
    testsBySkill.map((row) => [row.skill.toLowerCase(), row._count._all]),
  );

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <ResultsSection results={results as ShowcaseResult[]} />
        <PracticeSection counts={counts} />
        <WhySection />
        <TestimonialsSection testimonials={testimonials as Testimonial[]} />
      </main>
      <SiteFooter />
      <MobileCtaBar />
    </>
  );
}
