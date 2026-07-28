import { AdminPage, EmptyState } from "@/components/admin/AdminPage";
import { ReviewDecision } from "@/components/admin/ReviewDecision";
import { prisma } from "@/lib/db";

export default async function AnswerReviewsPage() {
  const reviews = await prisma.answerReview.findMany({
    where: { status: "PENDING" },
    orderBy: [{ occurrences: "desc" }, { createdAt: "asc" }],
    take: 100,
    select: {
      id: true,
      questionNumber: true,
      normalizedAnswer: true,
      rawExample: true,
      occurrences: true,
      test: { select: { title: true, slug: true, answerKey: true } },
    },
  });

  return (
    <AdminPage
      eyebrow="ANSWER REVIEWS"
      title={reviews.length === 0 ? "Nothing to review." : `${reviews.length} to decide.`}
      subtitle="Typed answers the grader marked wrong, grouped by how many students gave them. Accepting one adds it to the answer key for every future sitting; attempts already marked are left alone."
    >
      {reviews.length === 0 ? (
        <EmptyState>
          No unrecognised answers are waiting. They appear here as students sit tests.
        </EmptyState>
      ) : (
        <ul className="space-y-px bg-rule">
          {reviews.map((review) => {
            const key = review.test.answerKey as {
              answers?: Record<string, { accepted: string[] }>;
            } | null;
            const accepted = key?.answers?.[String(review.questionNumber)]?.accepted ?? [];

            return (
              <li
                key={review.id}
                className="flex flex-wrap items-center gap-4 bg-white px-5 py-4"
              >
                <span className="w-12 shrink-0 text-center font-display text-lg text-ink">
                  Q{review.questionNumber}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-ink-subtle">{review.test.title}</p>
                  <p className="mt-1 text-sm text-ink">
                    <strong className="font-bold">“{review.rawExample}”</strong>
                    <span className="ml-2 text-xs text-ink-subtle">
                      given by {review.occurrences} student{review.occurrences === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    Key accepts: {accepted.length > 0 ? accepted.join(", ") : "— nothing"}
                  </p>
                </div>

                <ReviewDecision reviewId={review.id} />
              </li>
            );
          })}
        </ul>
      )}
    </AdminPage>
  );
}
