import { prisma } from "@/lib/db";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/auth/password";
import {
  clearLoginFailures,
  isLoginThrottled,
  recordLoginAttempt,
} from "@/lib/auth/rate-limit";
import { clientIp, userAgent } from "@/lib/auth/request";
import { createSession } from "@/lib/auth/session";
import { fieldErrors, loginSchema } from "@/lib/auth/validation";

/**
 * Verified against a throwaway hash when the email is unknown, so a missing
 * account takes the same time as a wrong password and cannot be probed for.
 */
let decoyHash: string | null = null;
async function decoy(password: string): Promise<void> {
  decoyHash ??= await hashPassword("decoy-password-never-matches");
  await verifyPassword(password, decoyHash);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const { email, password } = parsed.data;
  const ip = clientIp(request);

  const { throttled, retryAfterSeconds } = await isLoginThrottled(email, ip);
  if (throttled) {
    return Response.json(
      { error: "Too many failed attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isPremium: true,
      passwordHash: true,
    },
  });

  if (!user) {
    await decoy(password);
    await recordLoginAttempt(email, false, ip);
    return Response.json({ error: "Email or password is incorrect" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await recordLoginAttempt(email, false, ip);
    return Response.json({ error: "Email or password is incorrect" }, { status: 401 });
  }

  // Upgrade the stored hash opportunistically, while we have the plaintext.
  if (needsRehash(user.passwordHash)) {
    await prisma.user
      .update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } })
      .catch(() => {});
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await recordLoginAttempt(email, true, ip);
  await clearLoginFailures(email);
  await createSession(user.id, { userAgent: userAgent(request), ipAddress: ip });

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isPremium: user.isPremium,
    },
  });
}
