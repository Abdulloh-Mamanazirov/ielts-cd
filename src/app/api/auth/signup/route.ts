import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { clientIp, readSubmittedBody, safeNext, userAgent } from "@/lib/auth/request";
import { createSession } from "@/lib/auth/session";
import { fieldErrors, signupSchema } from "@/lib/auth/validation";
import { loadAuthSettings } from "@/lib/auth-settings-store";

export async function POST(request: Request) {
  // Checked here and not only on the page: hiding a form removes the button,
  // not the endpoint behind it.
  if (!(await loadAuthSettings()).emailSignup) {
    return Response.json({ error: "Email sign-up is closed" }, { status: 403 });
  }

  const submitted = await readSubmittedBody(request);
  if (!submitted.ok) {
    return Response.json({ error: "Expected a JSON or form body" }, { status: 400 });
  }

  const { data: body, isFormPost } = submitted;
  const next = safeNext(body.next);

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    // A native post cannot read a JSON reply, so only a flag goes back — never
    // the name, email or password that was typed.
    if (isFormPost) {
      return Response.redirect(new URL("/signup?failed=invalid", request.url), 303);
    }
    return Response.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const { fullName, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    if (isFormPost) {
      return Response.redirect(new URL("/signup?failed=taken", request.url), 303);
    }
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

  if (isFormPost) return Response.redirect(new URL(next, request.url), 303);

  return Response.json({ user }, { status: 201 });
}
