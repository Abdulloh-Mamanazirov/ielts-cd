import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import type { Plan, Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "ielts_session";
const SESSION_TTL_DAYS = 30;
/** Past this fraction of its life, an active session gets a fresh expiry. */
const SLIDING_RENEW_AFTER = 0.5;

export type SessionUser = {
  id: string;
  /** Null for accounts created through the Telegram bot. */
  email: string | null;
  fullName: string;
  role: Role;
  isPremium: boolean;
  plan: Plan;
  planExpiresAt: Date | null;
  unlimitedMocks: boolean;
};

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters. See .env.example.",
    );
  }
  return secret;
}

/** Tokens are 256 bits of randomness, so the HMAC needs no per-row salt; the
 * secret keeps a leaked database from yielding usable cookies. */
function hashToken(token: string): string {
  return createHmac("sha256", sessionSecret()).update(token).digest("hex");
}

function ttl(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: ttl(),
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
      ipAddress: meta.ipAddress ?? null,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

/**
 * Resolves the signed-in user, or null. Premium and role are read from the
 * database on every call rather than cached in the cookie, so an admin
 * granting or revoking premium takes effect on the student's next request.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isPremium: true,
          plan: true,
          planExpiresAt: true,
          unlimitedMocks: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const age = Date.now() - session.lastSeenAt.getTime();
  const window = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  if (age > window * SLIDING_RENEW_AFTER) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), expiresAt: ttl() },
      })
      .catch(() => {});
  }

  return session.user;
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {});
  }

  store.delete(SESSION_COOKIE);
}

/** Used when an admin needs to force a user off every device. */
export async function destroyAllSessionsFor(userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
}

export async function purgeExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return count;
}

/** Constant-time compare for CSRF-style token checks elsewhere in the app. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
