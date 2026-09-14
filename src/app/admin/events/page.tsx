import Link from "next/link";

import { AdminPage, EmptyState } from "@/components/admin/AdminPage";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Events · Admin" };
export const dynamic = "force-dynamic";

const STATUS_STYLE = {
  DRAFT: "bg-surface-alt text-ink-subtle",
  OPEN: "bg-ok-soft text-ok",
  CLOSED: "bg-ink text-white",
} as const;

/** Every mock event, newest first, with how many have joined and finished. */
export default async function EventsAdminPage() {
  const events = await prisma.mockEvent.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      closesAt: true,
      maxParticipants: true,
      createdAt: true,
      _count: { select: { participants: true } },
      sittings: { select: { status: true } },
    },
  });

  return (
    <AdminPage
      eyebrow="EVENTS"
      title="Mock test events"
      subtitle="A fixed paper behind a private link. Share the link with a group; everyone who joins sits the same three sections once, and their results collect here."
      action={
        <Link
          href="/admin/events/new"
          className="rounded-[10px] bg-ink px-5 py-3 text-sm font-bold text-white transition hover:bg-ink/90"
        >
          New event
        </Link>
      }
    >
      {events.length === 0 ? (
        <EmptyState>No events yet. Create one and you will get a link to share.</EmptyState>
      ) : (
        <ul className="space-y-px bg-rule">
          {events.map((event) => {
            const finished = event.sittings.filter((s) => s.status === "COMPLETED").length;
            return (
              <li key={event.id}>
                <Link
                  href={`/admin/events/${event.id}`}
                  className="flex flex-wrap items-center gap-4 bg-white px-5 py-4 transition hover:bg-surface-alt"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{event.title}</p>
                    <p className="mt-1 text-xs text-ink-subtle">
                      Created {event.createdAt.toLocaleDateString()}
                      {event.closesAt && ` · closes ${event.closesAt.toLocaleString()}`}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-ink">
                      {event._count.participants}
                      {event.maxParticipants !== null && (
                        <span className="text-ink-subtle"> / {event.maxParticipants}</span>
                      )}
                    </p>
                    <p className="text-[10px] font-bold tracking-[0.16em] text-ink-subtle">
                      JOINED · {finished} DONE
                    </p>
                  </div>

                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.16em]",
                      STATUS_STYLE[event.status],
                    )}
                  >
                    {event.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AdminPage>
  );
}
