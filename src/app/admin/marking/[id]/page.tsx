import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPage } from "@/components/admin/AdminPage";
import { MarkForm } from "@/components/admin/MarkForm";
import { prisma } from "@/lib/db";

export default async function MarkAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const attempt = await prisma.attempt.findUnique({
    where: { id },
    select: {
      id: true,
      band: true,
      mode: true,
      submittedAt: true,
      timeSpentSeconds: true,
      result: true,
      user: { select: { fullName: true, email: true } },
      test: { select: { title: true, skill: true, content: true } },
      writingSubmission: {
        select: {
          task1Text: true,
          task2Text: true,
          task1WordCount: true,
          task2WordCount: true,
          instructorBand: true,
          instructorFeedback: true,
          reviewedAt: true,
        },
      },
      speakingRecordings: {
        orderBy: [{ part: "asc" }, { promptIndex: "asc" }],
        select: { id: true, part: true, promptIndex: true, durationSeconds: true },
      },
    },
  });

  if (!attempt || !attempt.submittedAt) notFound();
  if (attempt.test.skill !== "WRITING" && attempt.test.skill !== "SPEAKING") notFound();

  const content = attempt.test.content as {
    tasks?: Array<{ number: number; promptHtml: string; minWords: number }>;
    prompts?: Array<{ part: number; promptHtml: string }>;
  };

  const storedFeedback =
    (attempt.result as { instructorFeedback?: string } | null)?.instructorFeedback ?? null;

  return (
    <AdminPage
      eyebrow={`MARKING · ${attempt.test.skill}`}
      title={attempt.user.fullName}
      subtitle={
        <>
          {attempt.test.title} · {attempt.mode === "MOCK" ? "Mock" : "Practice"} ·{" "}
          {attempt.submittedAt.toLocaleString()}
        </>
      }
      action={
        <Link
          href="/admin/marking"
          className="rounded-[9px] bg-surface-alt px-4 py-2.5 text-[13px] font-bold text-ink-muted transition hover:bg-ink hover:text-white"
        >
          ← Queue
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {attempt.writingSubmission && (
            <>
              <Essay
                label="Task 1"
                prompt={content.tasks?.find((task) => task.number === 1)?.promptHtml}
                text={attempt.writingSubmission.task1Text}
                words={attempt.writingSubmission.task1WordCount}
                minWords={content.tasks?.find((task) => task.number === 1)?.minWords ?? 150}
              />
              {attempt.writingSubmission.task2Text !== null && (
                <Essay
                  label="Task 2"
                  prompt={content.tasks?.find((task) => task.number === 2)?.promptHtml}
                  text={attempt.writingSubmission.task2Text}
                  words={attempt.writingSubmission.task2WordCount}
                  minWords={content.tasks?.find((task) => task.number === 2)?.minWords ?? 250}
                />
              )}
            </>
          )}

          {attempt.speakingRecordings.length > 0 && (
            <section className="bg-white p-5">
              <p className="text-[10px] font-bold tracking-[0.2em] text-ink-subtle">RECORDINGS</p>
              <ul className="mt-4 space-y-4">
                {attempt.speakingRecordings.map((recording) => {
                  const prompt = content.prompts?.[recording.promptIndex ?? 0];
                  return (
                    <li key={recording.id}>
                      <p className="text-[11px] font-bold tracking-[0.14em] text-brand-blue">
                        PART {recording.part} · Q{(recording.promptIndex ?? 0) + 1}
                        {recording.durationSeconds ? ` · ${recording.durationSeconds}s` : ""}
                      </p>
                      {prompt && (
                        <div
                          className="mt-1 text-[13px] text-ink-muted [&_p]:mt-0"
                          dangerouslySetInnerHTML={{ __html: prompt.promptHtml }}
                        />
                      )}
                      <audio
                        controls
                        preload="none"
                        src={`/api/attempts/${attempt.id}/recordings/${recording.id}`}
                        className="mt-2 h-10 w-full"
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {attempt.speakingRecordings.length === 0 && !attempt.writingSubmission && (
            <p className="bg-white p-8 text-center text-sm text-ink-subtle">
              This attempt was submitted with nothing recorded or written.
            </p>
          )}
        </div>

        <MarkForm
          attemptId={attempt.id}
          skill={attempt.test.skill}
          currentBand={attempt.band}
          currentFeedback={attempt.writingSubmission?.instructorFeedback ?? storedFeedback}
          reviewedAt={attempt.writingSubmission?.reviewedAt?.toLocaleDateString() ?? null}
        />
      </div>
    </AdminPage>
  );
}

function Essay({
  label,
  prompt,
  text,
  words,
  minWords,
}: {
  label: string;
  prompt?: string;
  text: string;
  words: number;
  minWords: number;
}) {
  return (
    <section className="bg-white p-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-ink-subtle">
          {label.toUpperCase()}
        </p>
        <p
          className={
            words < minWords
              ? "text-[12px] font-bold tabular-nums text-brand-red-cta"
              : "text-[12px] font-bold tabular-nums text-ok"
          }
        >
          {words} / {minWords} words
        </p>
      </div>

      {prompt && (
        <div
          className="mt-3 border-l-2 border-brand-blue pl-3 text-[12.5px] leading-relaxed text-ink-muted [&_blockquote]:mt-1 [&_p]:mt-1"
          dangerouslySetInnerHTML={{ __html: prompt }}
        />
      )}

      {text.trim() ? (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-[1.75] text-ink">{text}</p>
      ) : (
        <p className="mt-4 text-sm italic text-ink-subtle">Left blank.</p>
      )}
    </section>
  );
}
