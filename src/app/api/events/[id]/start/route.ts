import { requireUserApi } from "@/lib/auth/guards";
import { startEventSitting, type JoinRefusal } from "@/lib/events/service";

/**
 * Enrols the signed-in student in an event and creates their sitting, or
 * returns the one they already have. The section itself is opened by the
 * ordinary full-mock start route, since that is what the sitting is.
 */
export const runtime = "nodejs";

const REFUSAL: Record<JoinRefusal, { status: number; error: string }> = {
  not_found: { status: 404, error: "This mock test does not exist." },
  not_open: { status: 409, error: "This mock test has not opened yet." },
  closed: { status: 409, error: "This mock test has closed." },
  full: { status: 409, error: "This mock test is full." },
};

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const result = await startEventSitting(id, auth.user.id);

  if (!result.ok) {
    const { status, error } = REFUSAL[result.reason];
    return Response.json({ error }, { status });
  }

  return Response.json(
    { fullMockId: result.fullMockId, resumed: result.resumed },
    { status: result.resumed ? 200 : 201 },
  );
}
