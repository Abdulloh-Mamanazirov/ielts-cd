/**
 * In production nginx sets X-Forwarded-For. Only the left-most entry is
 * meaningful, and it is still client-supplied, so it is used for rate-limiting
 * hints and audit rows only — never for authorization.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return request.headers.get("x-real-ip")?.slice(0, 64) ?? null;
}

export function userAgent(request: Request): string | null {
  return request.headers.get("user-agent")?.slice(0, 512) ?? null;
}

export type SubmittedBody =
  | { ok: true; data: Record<string, unknown>; isFormPost: boolean }
  | { ok: false };

/**
 * Reads a sign-in payload sent either as JSON (the normal path) or as a plain
 * form post.
 *
 * The form fallback matters: if the page has not hydrated — a stale bundle, a
 * tunnel blocking dev assets, JS disabled — the browser submits the form
 * natively. Handling that keeps sign-in working, and letting the form use POST
 * is what stops a password being serialized into the query string, where it
 * would land in history, referrers and the tunnel's request log.
 */
export async function readSubmittedBody(request: Request): Promise<SubmittedBody> {
  const type = request.headers.get("content-type") ?? "";

  try {
    if (type.includes("application/json")) {
      const data = await request.json();
      return { ok: true, data: data as Record<string, unknown>, isFormPost: false };
    }

    if (
      type.includes("application/x-www-form-urlencoded") ||
      type.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      return { ok: true, data: Object.fromEntries(form), isFormPost: true };
    }
  } catch {
    return { ok: false };
  }

  return { ok: false };
}

/**
 * Where a form post should land afterwards. Same-origin paths only — an open
 * redirect on the sign-in route is a phishing gift.
 */
export function safeNext(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  // Must be a path, not a URL.
  if (!value.startsWith("/")) return fallback;
  // `//host` is protocol-relative, and browsers resolve `/\host` the same way,
  // so both would leave the site while looking like a path.
  if (/^[/\\]{2}/.test(value) || value.includes("\\")) return fallback;
  return value;
}
