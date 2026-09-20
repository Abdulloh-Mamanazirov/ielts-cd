import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPage, EmptyState } from "@/components/admin/AdminPage";
import { EventControls } from "@/components/admin/EventControls";
import { EventForm } from "@/components/admin/EventForm";
import { SpeakingBandCell } from "@/components/admin/SpeakingBandCell";
import { prisma } from "@/lib/db";
import { asDateTimeInput, eventTestOptions } from "@/lib/events/admin";
import { eventRoster, type RosterRow } from "@/lib/events/service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dn-ielts.uz";

const STATE_LABEL: Record<RosterRow["state"], { text: string; className: string }> = {
  joined: { text: "JOINED", className: "text-ink-subtle" },
  in_progress: { text: "IN PROGRESS", className: "text-brand-blue" },
  awaiting_marking: { text: "MARK ESSAY", className: "text-brand-red-cta" },
  done: { text: "DONE", className: "text-ok" },
};

/** One event: its link and switches, the paper, and everyone who joined. */
export default async function EventAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [event, tests] = await Promise.all([
    prisma.mockEvent.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        token: true,
        status: true,
        closesAt: true,
        maxParticipants: true,
        listeningTestId: true,
        readingTestId: true,
        writingTestId: true,
        listeningTest: { select: { eventOnly: true } },
        readingTest: { select: { eventOnly: true } },
        writingTest: { select: { eventOnly: true } },
        _count: { select: { participants: true } },
      },
    }),
    eventTestOptions(),
  ]);
  if (!event) notFound();

  const roster = await eventRoster(event.id);
  const released =
    !event.listeningTest.eventOnly && !event.readingTest.eventOnly && !event.writingTest.eventOnly;

  const awaiting = roster.filter((row) => row.state === "awaiting_marking").length;

  return (
    <AdminPage
      eyebrow="EVENTS"
      title={event.title}
      subtitle={
        <>
          {event._count.participants} joined
          {awaiting > 0 && (
            <>
              {" · "}
              <span className="font-bold text-brand-red-cta">
                {awaiting} essay{awaiting === 1 ? "" : "s"} to mark
              </span>
            </>
          )}
          {" · "}
          <Link href="/admin/events" className="font-semibold text-brand-blue hover:underline">
            All events
          </Link>
        </>
      }
      action={
        roster.length > 0 ? (
          <a
            href={`/api/admin/events/${event.id}/export`}
            className="rounded-[10px] bg-surface-alt px-5 py-3 text-sm font-bold text-ink transition hover:bg-ink hover:text-white"
          >
            Download CSV
          </a>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <EventControls
          eventId={event.id}
          status={event.status}
          joinUrl={`${SITE_URL}/join/${event.token}`}
          released={released}
          participants={event._count.participants}
        />

        <section>
          <h2 className="mb-3 text-[10px] font-bold tracking-[0.22em] text-ink-subtle">
            PARTICIPANTS
          </h2>
          <p className="mb-3 text-[12px] text-ink-subtle">
            L, R and W come from the paper. Type the speaking band into <strong>S</strong> after
            the interview; the overall updates as soon as it is in.
          </p>
          {roster.length === 0 ? (
            <EmptyState>Nobody has joined yet. Share the link above.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-white shadow-[0_1px_2px_rgba(11,17,32,.08)]">
              <table className="w-full min-w-[820px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-rule text-[10px] font-bold tracking-[0.16em] text-ink-subtle">
                    <th className="px-4 py-3">STUDENT</th>
                    <th className="px-3 py-3">TELEGRAM</th>
                    <th className="px-3 py-3">PHONE</th>
                    <th className="px-3 py-3 text-right">L</th>
                    <th className="px-3 py-3 text-right">R</th>
                    <th className="px-3 py-3 text-right">W</th>
                    <th className="px-3 py-3 text-right">S</th>
                    <th className="px-3 py-3 text-right">OVERALL</th>
                    <th className="px-4 py-3 text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((row) => {
                    const state = STATE_LABEL[row.state];
                    return (
                      <tr key={row.participantId} className="border-b border-rule last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-bold text-ink">{row.fullName}</p>
                          <p className="text-[11px] text-ink-subtle">
                            joined {row.joinedAt.toLocaleDateString()}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-ink-muted">
                          {row.telegramUsername ? (
                            <a
                              href={`https://t.me/${row.telegramUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-brand-blue hover:underline"
                            >
                              @{row.telegramUsername}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-3 text-ink-muted">{row.phone ?? "—"}</td>
                        <Band value={row.listening} />
                        <Band value={row.reading} />
                        <Band value={row.writing} />
                        {/* Speaking is examined face to face and typed in here. */}
                        <td className="px-3 py-3 text-right">
                          <SpeakingBandCell
                            participantId={row.participantId}
                            band={row.speaking}
                            disabled={row.fullMockId === null}
                          />
                        </td>
                        <td className="px-3 py-3 text-right font-display text-base text-brand-red">
                          {row.overall?.toFixed(1) ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.state === "awaiting_marking" && row.writingAttemptId ? (
                            <Link
                              href={`/admin/marking/${row.writingAttemptId}`}
                              className={cn(
                                "text-[10.5px] font-bold tracking-[0.12em] hover:underline",
                                state.className,
                              )}
                            >
                              {state.text} →
                            </Link>
                          ) : (
                            <span className={cn("text-[10.5px] font-bold tracking-[0.12em]", state.className)}>
                              {state.text}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-[10px] font-bold tracking-[0.22em] text-ink-subtle">
            DETAILS
          </h2>
          <EventForm
            initial={{
              id: event.id,
              title: event.title,
              description: event.description ?? "",
              listeningTestId: event.listeningTestId,
              readingTestId: event.readingTestId,
              writingTestId: event.writingTestId,
              closesAt: asDateTimeInput(event.closesAt),
              maxParticipants: event.maxParticipants,
            }}
            tests={tests}
            locked={event._count.participants > 0}
          />
        </section>
      </div>
    </AdminPage>
  );
}

function Band({ value }: { value: number | null }) {
  return (
    <td className="px-3 py-3 text-right font-bold tabular-nums text-ink">
      {value !== null ? value.toFixed(1) : <span className="text-ink-faint">—</span>}
    </td>
  );
}
