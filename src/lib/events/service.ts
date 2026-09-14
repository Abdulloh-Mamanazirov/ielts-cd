import { prisma } from "@/lib/db";
import { joinRefusal, type JoinRefusal } from "./rules";

export { joinRefusal, newEventToken, type JoinRefusal } from "./rules";

/**
 * Mock events: a fixed paper behind a private link.
 *
 * A sitting is an ordinary FullMock with `eventId` set and its three attempts
 * created from the event's tests rather than drawn from the library. Everything
 * after that — section timing, grading, the marking queue, the dashboard — is
 * the machinery every other mock already runs through.
 */

/** The event behind a join link, with what the join page needs to decide. */
export async function eventForJoin(token: string, userId: string | null) {
  const event = await prisma.mockEvent.findUnique({
    where: { token },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      closesAt: true,
      maxParticipants: true,
      listeningTest: { select: { title: true, durationSeconds: true, audioAssetId: true } },
      readingTest: { select: { title: true, durationSeconds: true } },
      writingTest: { select: { title: true, durationSeconds: true } },
      _count: { select: { participants: true } },
    },
  });
  if (!event) return null;

  const participant = userId
    ? await prisma.eventParticipant.findUnique({
        where: { eventId_userId: { eventId: event.id, userId } },
        select: {
          fullMock: {
            select: {
              id: true,
              status: true,
              overallBand: true,
              attempts: {
                orderBy: { sequence: "asc" },
                select: {
                  id: true,
                  status: true,
                  band: true,
                  reviewRequested: true,
                  test: { select: { skill: true } },
                },
              },
            },
          },
        },
      })
    : null;

  return { ...event, participant };
}

/**
 * Enrols the student and creates their sitting, or returns the one they
 * already have. Idempotent, so a double-click or a reopened link cannot give
 * anyone a second paper.
 */
export async function startEventSitting(
  eventId: string,
  userId: string,
): Promise<{ ok: true; fullMockId: string; resumed: boolean } | { ok: false; reason: JoinRefusal }> {
  const event = await prisma.mockEvent.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      closesAt: true,
      maxParticipants: true,
      listeningTestId: true,
      readingTestId: true,
      writingTestId: true,
      _count: { select: { participants: true } },
    },
  });
  if (!event) return { ok: false, reason: "not_found" };

  const existing = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { id: true, fullMockId: true },
  });
  if (existing?.fullMockId) return { ok: true, fullMockId: existing.fullMockId, resumed: true };

  const refusal = joinRefusal({
    ...event,
    participantCount: event._count.participants,
    alreadyIn: Boolean(existing),
  });
  if (refusal) return { ok: false, reason: refusal };

  // Exam order. Sections are created up front so the paper is fixed, and each
  // stays untimed until the student opens it — the same rule as any mock.
  const paper = [event.listeningTestId, event.readingTestId, event.writingTestId];

  const fullMock = await prisma.fullMock.create({
    data: {
      userId,
      eventId,
      includeSpeaking: false,
      attempts: {
        create: paper.map((testId, index) => ({
          userId,
          testId,
          mode: "MOCK" as const,
          sequence: index + 1,
        })),
      },
    },
    select: { id: true },
  });

  await prisma.eventParticipant.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId, fullMockId: fullMock.id },
    update: { fullMockId: fullMock.id },
  });

  return { ok: true, fullMockId: fullMock.id, resumed: false };
}

/** Whether an attempt belongs to an event sitting, for the marking rule. */
export async function attemptIsInEvent(fullMockId: string | null): Promise<boolean> {
  if (!fullMockId) return false;
  const mock = await prisma.fullMock.findUnique({
    where: { id: fullMockId },
    select: { eventId: true },
  });
  return Boolean(mock?.eventId);
}

export type RosterRow = {
  participantId: string;
  userId: string;
  fullName: string;
  telegramUsername: string | null;
  phone: string | null;
  joinedAt: Date;
  fullMockId: string | null;
  listening: number | null;
  reading: number | null;
  writing: number | null;
  overall: number | null;
  /** The writing attempt, for the link into the marking screen. */
  writingAttemptId: string | null;
  state: "joined" | "in_progress" | "awaiting_marking" | "done";
};

/** Everyone in an event and how far they got, one row each. */
export async function eventRoster(eventId: string): Promise<RosterRow[]> {
  const rows = await prisma.eventParticipant.findMany({
    where: { eventId },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      joinedAt: true,
      user: { select: { id: true, fullName: true, telegramUsername: true, phone: true } },
      fullMock: {
        select: {
          id: true,
          status: true,
          overallBand: true,
          attempts: {
            select: { id: true, status: true, band: true, test: { select: { skill: true } } },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const attempts = row.fullMock?.attempts ?? [];
    const bandFor = (skill: string) =>
      attempts.find((attempt) => attempt.test.skill === skill)?.band ?? null;
    const writing = attempts.find((a) => a.test.skill === "WRITING") ?? null;

    let state: RosterRow["state"] = "joined";
    if (row.fullMock) {
      const allSubmitted = attempts.length > 0 && attempts.every((a) => a.status === "SUBMITTED");
      if (!allSubmitted) state = "in_progress";
      else if (writing && writing.band === null) state = "awaiting_marking";
      else state = "done";
    }

    return {
      participantId: row.id,
      userId: row.user.id,
      fullName: row.user.fullName,
      telegramUsername: row.user.telegramUsername,
      phone: row.user.phone,
      joinedAt: row.joinedAt,
      fullMockId: row.fullMock?.id ?? null,
      listening: bandFor("LISTENING"),
      reading: bandFor("READING"),
      writing: bandFor("WRITING"),
      overall: row.fullMock?.overallBand ?? null,
      writingAttemptId: writing?.id ?? null,
      state,
    };
  });
}
