import Link from "next/link";

import { AdminPage } from "@/components/admin/AdminPage";
import { ShowcaseResults, type ShowcaseRow } from "@/components/admin/ShowcaseResults";
import { ShowcaseReviews, type ReviewRow } from "@/components/admin/ShowcaseReviews";
import { prisma } from "@/lib/db";

export const metadata = { title: "Results and reviews · Admin" };
export const dynamic = "force-dynamic";

/** yyyy-mm-dd, which is what a date input reads and writes. */
function asDateInput(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/**
 * The hand-curated content on the home page and /results.
 *
 * These rows are marketing, not attempts: most of the students whose bands are
 * shown sat the real exam elsewhere, so there is nothing in the database to
 * derive them from. Until now they were only editable by hand in the seed
 * script, which meant the instructor could not add a result without a developer.
 */
export default async function ShowcaseAdminPage() {
  const [results, reviews] = await Promise.all([
    prisma.showcaseResult.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.testimonial.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const resultRows: ShowcaseRow[] = results.map((row) => ({
    id: row.id,
    studentName: row.studentName,
    overallBand: row.overallBand,
    listening: row.listening,
    reading: row.reading,
    writing: row.writing,
    speaking: row.speaking,
    quoteEn: row.quoteEn,
    quoteUz: row.quoteUz,
    quoteRu: row.quoteRu,
    certificateUrl: row.certificateUrl,
    testDate: asDateInput(row.testDate),
    isVisible: row.isVisible,
  }));

  const reviewRows: ReviewRow[] = reviews.map((row) => ({
    id: row.id,
    studentName: row.studentName,
    rating: row.rating,
    mediaType: row.mediaType,
    mediaUrl: row.mediaUrl,
    thumbnailUrl: row.thumbnailUrl,
    caption: row.caption,
    quoteEn: row.quoteEn,
    quoteUz: row.quoteUz,
    quoteRu: row.quoteRu,
    isVisible: row.isVisible,
  }));

  return (
    <AdminPage
      eyebrow="HOME PAGE"
      title="Results and reviews"
      subtitle={
        <>
          What visitors see on the{" "}
          <Link href="/" className="font-semibold text-brand-blue hover:underline">
            home page
          </Link>{" "}
          and on{" "}
          <Link href="/results" className="font-semibold text-brand-blue hover:underline">
            /results
          </Link>
          . Hidden rows stay saved but are not published. The arrows set the home page order;
          the results page leads with the highest band and only uses this order to break a tie.
        </>
      }
    >
      <div className="space-y-10">
        <ShowcaseResults rows={resultRows} />
        <ShowcaseReviews rows={reviewRows} />
      </div>
    </AdminPage>
  );
}
