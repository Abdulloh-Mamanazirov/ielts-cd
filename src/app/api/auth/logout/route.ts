import { destroyCurrentSession } from "@/lib/auth/session";

export async function POST() {
  await destroyCurrentSession();
  return Response.json({ ok: true });
}
