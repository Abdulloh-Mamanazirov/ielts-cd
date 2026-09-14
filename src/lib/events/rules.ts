import { randomBytes } from "node:crypto";

import type { MockEventStatus } from "@/generated/prisma/enums";

/**
 * The rules of a mock event, free of any database import so they can be
 * tested on their own — the same split as full-mock/select.ts.
 */

/** Twelve URL-safe characters: not guessable, short enough to read out. */
export function newEventToken(): string {
  return randomBytes(9).toString("base64url");
}

export type JoinRefusal =
  | "not_found"
  | "not_open"
  | "closed"
  | "full";

/**
 * Whether a visitor may join right now. Checked on the page and again in the
 * action, since a link can be shared long after the event has closed.
 */
export function joinRefusal(event: {
  status: MockEventStatus;
  closesAt: Date | null;
  maxParticipants: number | null;
  participantCount: number;
  alreadyIn: boolean;
}): JoinRefusal | null {
  if (event.status === "DRAFT") return "not_open";
  if (event.status === "CLOSED") return "closed";
  if (event.closesAt && event.closesAt.getTime() < Date.now()) return "closed";
  // Someone already in stays in — a cap keeps newcomers out, not returners.
  if (
    !event.alreadyIn &&
    event.maxParticipants !== null &&
    event.participantCount >= event.maxParticipants
  ) {
    return "full";
  }
  return null;
}
