import { prisma } from "@/lib/db";

const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 8;
const MAX_FAILURES_PER_IP = 20;

function windowStart(): Date {
  return new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
}

export async function recordLoginAttempt(
  identifier: string,
  succeeded: boolean,
  ipAddress?: string | null,
): Promise<void> {
  await prisma.loginAttempt.create({
    data: { identifier: identifier.toLowerCase(), succeeded, ipAddress: ipAddress ?? null },
  });
}

/**
 * Throttles by email and by IP together: the email limit stops one account
 * being ground down, the looser IP limit stops one host spraying many accounts.
 */
export async function isLoginThrottled(
  identifier: string,
  ipAddress?: string | null,
): Promise<{ throttled: boolean; retryAfterSeconds: number }> {
  const since = windowStart();

  const [emailFailures, ipFailures] = await Promise.all([
    prisma.loginAttempt.count({
      where: { identifier: identifier.toLowerCase(), succeeded: false, createdAt: { gte: since } },
    }),
    ipAddress
      ? prisma.loginAttempt.count({
          where: { ipAddress, succeeded: false, createdAt: { gte: since } },
        })
      : Promise.resolve(0),
  ]);

  const throttled =
    emailFailures >= MAX_FAILURES_PER_EMAIL || ipFailures >= MAX_FAILURES_PER_IP;

  return { throttled, retryAfterSeconds: throttled ? WINDOW_MINUTES * 60 : 0 };
}

/** Called after a successful login so a user is not punished for earlier typos. */
export async function clearLoginFailures(identifier: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({
    where: { identifier: identifier.toLowerCase(), succeeded: false },
  });
}

export async function purgeOldLoginAttempts(): Promise<number> {
  const { count } = await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });
  return count;
}
