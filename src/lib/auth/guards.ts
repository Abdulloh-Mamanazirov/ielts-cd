import { redirect } from "next/navigation";

import { getSessionUser, type SessionUser } from "./session";

/** For server components. Sends anonymous visitors to the login page. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const target = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${target}`);
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fadmin");
  // Deliberately a 404 rather than a 403: an authenticated non-admin should not
  // be able to confirm the admin area exists.
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

/** For route handlers, which return a response instead of redirecting. */
export async function requireUserApi(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: Response }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

export async function requireAdminApi(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: Response }
> {
  const result = await requireUserApi();
  if (!result.ok) return result;
  if (result.user.role !== "ADMIN") {
    return {
      ok: false,
      response: Response.json({ error: "Not found" }, { status: 404 }),
    };
  }
  return result;
}

/** Premium tests are gated here and nowhere else, so the rule has one home. */
export function canAccessTest(
  user: SessionUser | null,
  test: { isPremium: boolean },
): boolean {
  if (!test.isPremium) return Boolean(user);
  if (!user) return false;
  return user.isPremium || user.role === "ADMIN";
}
