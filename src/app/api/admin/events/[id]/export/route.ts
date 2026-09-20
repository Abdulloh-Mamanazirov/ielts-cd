import { requireAdminApi } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { eventRoster } from "@/lib/events/service";

/**
 * The roster as a CSV: the lead list the event was run to collect, in a shape
 * a spreadsheet opens without help.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADER = [
  "Name",
  "Telegram",
  "Phone",
  "Joined",
  "Listening",
  "Reading",
  "Writing",
  "Speaking",
  "Overall",
  "Status",
];

/** RFC 4180: quote everything, double any quote inside. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const event = await prisma.mockEvent.findUnique({ where: { id }, select: { title: true } });
  if (!event) return new Response(null, { status: 404 });

  const roster = await eventRoster(id);
  const lines = [
    HEADER.map(cell).join(","),
    ...roster.map((row) =>
      [
        row.fullName,
        row.telegramUsername ? `@${row.telegramUsername}` : null,
        row.phone,
        row.joinedAt.toISOString().slice(0, 10),
        row.listening,
        row.reading,
        row.writing,
        row.speaking,
        row.overall,
        row.state.replace("_", " "),
      ]
        .map(cell)
        .join(","),
    ),
  ];

  const filename = `${event.title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event"}.csv`;

  // A BOM so Excel reads the UTF-8 names correctly instead of as mojibake.
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
