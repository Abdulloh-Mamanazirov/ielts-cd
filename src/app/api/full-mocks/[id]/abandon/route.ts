import { requireUserApi } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

/**
 * Gives up on a mock.
 *
 * Without this a student who starts one and walks away is stuck: only one mock
 * may run at a time, so an abandoned sitting would block every future one.
 *
 * Sections already submitted keep their bands and stay on the dashboard — the
 * student did sit them, and deleting earned marks to tidy up a mock would be
 * the wrong trade.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  const fullMock = await prisma.fullMock.findFirst({
    where: { id, userId: auth.user.id },
    select: { id: true, status: true, eventId: true },
  });

  if (!fullMock) return Response.json({ error: "Full mock not found" }, { status: 404 });
  if (fullMock.status !== "IN_PROGRESS") {
    return Response.json({ error: "That mock is already finished" }, { status: 409 });
  }
  // An event is one sitting per person. Giving it up would either lock them out
  // or, if a second were allowed, let them see the paper twice.
  if (fullMock.eventId) {
    return Response.json({ error: "A mock test sitting cannot be abandoned" }, { status: 409 });
  }

  await prisma.attempt.updateMany({
    where: { fullMockId: id, status: "IN_PROGRESS" },
    data: { status: "ABANDONED" },
  });

  await prisma.fullMock.update({
    where: { id },
    data: { status: "ABANDONED", completedAt: new Date() },
  });

  return Response.json({ ok: true });
}
