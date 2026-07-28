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
