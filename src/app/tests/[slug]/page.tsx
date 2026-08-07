import { notFound } from "next/navigation";

import { StartTestForm } from "@/components/player/StartTestForm";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { describeTest } from "@/lib/skills";
import { getPlayableTest } from "@/lib/tests/access";

export default async function TestStartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/tests/${slug}`);

  const record = await prisma.test.findUnique({ where: { slug }, select: { id: true } });
  if (!record) notFound();

  const access = await getPlayableTest(record.id, user);

  if (!access.ok) {
    const messages: Record<string, string> = {
      not_found: "This test is not available.",
      premium_required:
        "This is a premium test. Ask the admin to unlock premium access for your account.",
      unavailable: "This test is not ready yet — its audio has not been uploaded.",
      not_signed_in: "Please sign in.",
    };

    return (
      <main className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="text-xl font-bold text-ink">Not available</h1>
        <p className="mt-2 text-sm text-ink-muted">{messages[access.reason]}</p>
      </main>
    );
  }

  const test = access.test;

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-red">
        {test.skill} · Academic
      </p>
      <h1 className="mt-1 text-2xl font-bold text-ink">{test.title}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {describeTest(test.totalQuestions, test.durationSeconds, "minutes")}
      </p>

      <StartTestForm
        testId={test.id}
        durationMinutes={Math.round(test.durationSeconds / 60)}
        skill={test.skill}
      />
    </main>
  );
}
