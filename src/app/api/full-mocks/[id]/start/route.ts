import { requireUserApi } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { deadlineFor } from "@/lib/attempts/service";

/**
 * Opens the next section of a mock. The section's clock starts here, not when
 * the mock was created — otherwise reading would be timing out while the
 * student was still on listening.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  const fullMock = await prisma.fullMock.findFirst({
    where: { id, userId: auth.user.id },
    select: {
      id: true,
      status: true,
      attempts: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          status: true,
          sequence: true,
          expiresAt: true,
          test: { select: { durationSeconds: true } },
        },
      },
    },
  });

  if (!fullMock) return Response.json({ error: "Full mock not found" }, { status: 404 });
  if (fullMock.status !== "IN_PROGRESS") {
    return Response.json({ error: "This mock is already finished" }, { status: 409 });
  }

  const next = fullMock.attempts.find((attempt) => attempt.status === "IN_PROGRESS");
  if (!next) return Response.json({ error: "Every section is done" }, { status: 409 });

  // Resuming a section that already started keeps its original deadline, so
  // reloading the page cannot buy more time.
  if (!next.expiresAt) {
    await prisma.attempt.update({
      where: { id: next.id },
      data: { expiresAt: deadlineFor("MOCK", next.test.durationSeconds) },
    });
  }

  return Response.json({ attemptId: next.id, sequence: next.sequence });
}
