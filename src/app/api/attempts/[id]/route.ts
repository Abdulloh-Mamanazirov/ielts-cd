import { z } from "zod";

import { requireUserApi } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { isExpired } from "@/lib/attempts/service";
import type { Prisma } from "@/generated/prisma/client";

const patchSchema = z.object({
  answers: z.record(z.string().regex(/^\d+$/), z.string()).optional(),
  flags: z.array(z.number().int().positive()).optional(),
  // Highlights and notes are the client's own format; the server only stores them.
  annotations: z.json().optional(),
});

async function loadOwnedAttempt(id: string, userId: string) {
  return prisma.attempt.findFirst({
    where: { id, userId },
    select: {
      id: true,
      testId: true,
      mode: true,
      status: true,
      answers: true,
      flags: true,
      annotations: true,
      startedAt: true,
      expiresAt: true,
      submittedAt: true,
      rawScore: true,
      band: true,
    },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const attempt = await loadOwnedAttempt(id, auth.user.id);
  if (!attempt) return Response.json({ error: "Attempt not found" }, { status: 404 });

  return Response.json({ attempt });
}

/** Autosave. Merges the incoming answers so a stale tab cannot blank the rest. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid autosave payload" }, { status: 422 });
  }

  const attempt = await loadOwnedAttempt(id, auth.user.id);
  if (!attempt) return Response.json({ error: "Attempt not found" }, { status: 404 });

  if (attempt.status !== "IN_PROGRESS") {
    return Response.json({ error: "This attempt has already been submitted" }, { status: 409 });
  }

  // The deadline is the server's, so a paused or tampered client clock cannot
  // buy extra time. The client is told to submit rather than silently losing work.
  if (isExpired(attempt.expiresAt)) {
    return Response.json({ error: "Time is up", expired: true }, { status: 409 });
  }

  const merged = {
    ...(attempt.answers as Record<string, string>),
    ...(parsed.data.answers ?? {}),
  };

  await prisma.attempt.update({
    where: { id },
    data: {
      answers: merged,
      ...(parsed.data.flags ? { flags: parsed.data.flags } : {}),
      ...(parsed.data.annotations
        ? { annotations: parsed.data.annotations as Prisma.InputJsonValue }
        : {}),
    },
  });

  return Response.json({ ok: true, savedAt: new Date().toISOString() });
}
