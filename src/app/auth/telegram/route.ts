import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { consumeLoginToken } from "@/lib/telegram/bot";

/**
 * Turns the bot's one-time link into a browser session.
 *
 * A GET that signs someone in is only safe because the token is single use,
 * short lived, and unguessable — following the same link twice does nothing.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) redirect("/login?error=telegram");

  const userId = await consumeLoginToken(token);
  if (!userId) redirect("/login?error=expired");

  await createSession(userId, {
    userAgent: request.headers.get("user-agent"),
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  await prisma.user
    .update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
    .catch(() => {});

  redirect("/dashboard");
}
