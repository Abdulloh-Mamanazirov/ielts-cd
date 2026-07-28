import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { clientIp, userAgent } from "@/lib/auth/request";
import { createSession } from "@/lib/auth/session";
import { fieldErrors, signupSchema } from "@/lib/auth/validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const { fullName, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return Response.json(
      { errors: { email: "An account with this email already exists" } },
      { status: 409 },
    );
  }

  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash: await hashPassword(password),
      lastLoginAt: new Date(),
    },
    select: { id: true, email: true, fullName: true, role: true, isPremium: true },
  });

  await createSession(user.id, {
    userAgent: userAgent(request),
    ipAddress: clientIp(request),
  });

  return Response.json({ user }, { status: 201 });
}
