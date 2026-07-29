"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { PlayableTest } from "@/lib/tests/access";
import { countWords } from "@/lib/tests/normalize";
import { cn } from "@/lib/utils";
import { PlayerHeader } from "./PlayerChrome";
import { RichHtml } from "./SlotHtml";
import { SplitView } from "./SplitView";
import { Cell, ConfirmDialog } from "./SubmitDialog";
import { useAutosave } from "./useAutosave";
import { useCountdown } from "./useCountdown";
import { useTextSize } from "./useTextSize";
import type { AttemptSnapshot } from "./TestPlayer";

/**
 * The writing test. Nothing here is graded: the essay goes to the instructor,
 * so the screen's whole job is to keep the prompt and the word count in front
 * of the student and never lose a keystroke.
 *
 * Task text is stored in the attempt's `answers` map keyed by task number,
 * which is why it rides the existing autosave endpoint untouched.
 */
export function WritingPlayer({
  test,
  attempt,
  canRequestReview,
}: {
  test: PlayableTest;
  attempt: AttemptSnapshot;
  /** Instructor marking is the paid part; free students still keep their work. */
  canRequestReview: boolean;
}) {
  const tasks = useMemo(
    () => [...(test.content.tasks ?? [])].sort((a, b) => a.number - b.number),
    [test.content.tasks],
  );

  const [texts, setTexts] = useState<Record<string, string>>(attempt.answers ?? {});
  const [activeTask, setActiveTask] = useState(tasks[0]?.number ?? 1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { queue, flush, status } = useAutosave(attempt.id);
  const { size, step, canDecrease, canIncrease } = useTextSize();

  const handleChange = useCallback(
    (taskNumber: number, value: string) => {
      setTexts((previous) => ({ ...previous, [String(taskNumber)]: value }));
      queue({ answers: { [String(taskNumber)]: value } });
    },
    [queue],
  );

  const submit = useCallback(async (forReview: boolean) => {
    if (submitting || submitted) return;

    setSubmitting(true);
    await flush();

    try {
      const response = await fetch(`/api/attempts/${attempt.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: texts, forReview }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        window.alert(data?.error ?? "Could not submit. Please try again.");
        return;
      }

      setSubmitted(true);
      setDialogOpen(false);
      // Unlike a graded test there is nothing to review in place, so the
      // results page is the right destination — unless another section of a
      // full mock is waiting.
      window.location.href = attempt.fullMockId
        ? "/full-mock"
        : `/dashboard/results/${attempt.id}`;
    } finally {
      setSubmitting(false);
    }
  }, [attempt.fullMockId, attempt.id, flush, submitted, submitting, texts]);

  const autoSubmit = useCallback(() => {
    // Time running out finishes the attempt. Whether it also goes to the
    // instructor follows the same rule as pressing the button would.
    void submit(canRequestReview);
  }, [canRequestReview, submit]);

  const remaining = useCountdown(attempt.expiresAt, submitted, autoSubmit);
  const current = tasks.find((task) => task.number === activeTask) ?? tasks[0];

  const counts = tasks.map((task) => ({
    task,
    words: countWords(texts[String(task.number)] ?? ""),
  }));
  const totalWords = counts.reduce((sum, entry) => sum + entry.words, 0);
  const shortTasks = counts.filter((entry) => entry.words < entry.task.minWords);

  const download = useCallback(() => {
    const body = tasks
      .map((task) => {
        const text = texts[String(task.number)] ?? "";
        return `TASK ${task.number} (${countWords(text)} words)\n\n${text}`;
      })
      .join("\n\n\n");

    const blob = new Blob([`${test.title}\n\n${body}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${test.slug}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }, [tasks, test.slug, test.title, texts]);

  if (!current) {
    return <p className="p-8 text-sm text-ink-muted">This test has no tasks.</p>;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface-alt">
      <PlayerHeader
        title={test.title}
        subtitle={`${attempt.mode === "MOCK" ? "Mock" : "Practice"} · ${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
        exitHref={attempt.fullMockId ? "/full-mock" : `/tests?skill=${test.skill}`}
        remaining={remaining}
        totalSeconds={test.durationSeconds}
        saveStatus={status}
        textSize={size}
        onTextSize={step}
        canDecrease={canDecrease}
        canIncrease={canIncrease}
        onSubmit={() => setDialogOpen(true)}
        submitting={submitting}
      />

      <SplitView
        leftLabel={`Task ${current.number}`}
        rightLabel="Your answer"
        left={
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:px-8" style={{ fontSize: size }}>
            <p className="text-[10px] font-bold tracking-[0.22em] text-ink-subtle">
              WRITING TASK {current.number}
            </p>
            <p className="mt-2 text-[13px] font-semibold text-ink-muted">
              You should spend about {current.suggestedMinutes} minutes on this task. Write at least{" "}
              {current.minWords} words.
            </p>

            <RichHtml
              html={current.promptHtml}
              className="mt-5 leading-relaxed text-ink [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-red [&_blockquote]:pl-4 [&_blockquote]:font-serif [&_blockquote]:text-[1.05em] [&_p]:mt-3"
            />

            {current.imageUrl && (
              // The prompt above already describes what the visual shows, which
              // is what an empty alt defers to rather than repeating.
              <figure className="mt-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.imageUrl}
                  alt=""
                  className="w-full rounded-lg bg-white shadow-[0_1px_2px_rgba(11,17,32,.12)]"
                />
              </figure>
            )}
          </div>
        }
        right={
          <Editor
            key={current.number}
            value={texts[String(current.number)] ?? ""}
            onChange={(value) => handleChange(current.number, value)}
            minWords={current.minWords}
            fontSize={size}
            disabled={submitted}
            onDownload={download}
          />
        }
      />

      {/* Along the bottom, like the reading and listening navigator and like the
          real test — the switch between tasks is navigation, and navigation on
          this screen lives in one place. Under the header it also sat between
          the student and the prompt they were meant to be reading. */}
      {tasks.length > 1 && (
        <nav
          aria-label="Writing tasks"
          className="flex flex-none items-center gap-1 border-t border-ink/[0.12] bg-white px-3 py-2 lg:px-[18px]"
        >
          {counts.map(({ task, words }) => {
            const here = task.number === activeTask;
            const met = words >= task.minWords;

            return (
              <button
                key={task.number}
                type="button"
                onClick={() => setActiveTask(task.number)}
                aria-current={here ? "true" : undefined}
                aria-label={`Task ${task.number}, ${words} of ${task.minWords} words written`}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 transition",
                  here ? "bg-surface-alt" : "hover:bg-surface-alt",
                )}
              >
                <span
                  className={cn(
                    "text-[12.5px] font-bold",
                    here ? "text-ink" : "text-ink-muted",
                  )}
                >
                  Task {task.number}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "text-[12.5px] tabular-nums",
                    met ? "text-ok" : "text-ink-subtle",
                  )}
                >
                  {words}/{task.minWords}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      <ConfirmDialog
        open={dialogOpen}
        eyebrow="SUBMIT TEST"
        title={
          shortTasks.length === 0
            ? "Both tasks meet the word count."
            : `Task ${shortTasks.map((entry) => entry.task.number).join(" and ")} ${
                shortTasks.length === 1 ? "is" : "are"
              } under the minimum.`
        }
        confirmLabel={canRequestReview ? "Send to my instructor" : "Finish and keep my work"}
        confirmingLabel="Finishing…"
        cancelLabel="Keep writing"
        submitting={submitting}
        onConfirm={() => void submit(canRequestReview)}
        onCancel={() => setDialogOpen(false)}
        secondaryLabel={canRequestReview ? "Finish without sending" : undefined}
        onSecondary={canRequestReview ? () => void submit(false) : undefined}
      >
        <dl className="mt-5 flex gap-px overflow-hidden rounded-lg bg-rule">
          {counts.map(({ task, words }) => (
            <Cell
              key={task.number}
              label={`Task ${task.number}`}
              value={`${words}/${task.minWords}`}
              accent={words < task.minWords}
            />
          ))}
          <Cell label="Total" value={String(totalWords)} />
        </dl>

        <p className="mt-5 text-sm leading-relaxed text-ink-muted">
          {canRequestReview
            ? "Writing is marked by a person, so there is no band straight away. Send it and it appears on your dashboard once your instructor has read it — or finish without sending and keep it to yourself."
            : "Your work is saved to your dashboard either way. Marking by your instructor is part of premium; ask them to unlock it if you would like a band."}
        </p>
      </ConfirmDialog>
    </div>
  );
}

/**
 * A plain textarea, deliberately. The exam gives no formatting, and a rich
 * editor would let a student produce something they cannot reproduce on the day.
 */
function Editor({
  value,
  onChange,
  minWords,
  fontSize,
  disabled,
  onDownload,
}: {
  value: string;
  onChange: (value: string) => void;
  minWords: number;
  fontSize: number;
  disabled: boolean;
  onDownload: () => void;
}) {
  const words = countWords(value);
  const short = words < minWords;
  const areaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <textarea
        ref={areaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        spellCheck={false}
        aria-label="Your answer"
        placeholder="Type your answer here."
        style={{ fontSize }}
        className="min-h-0 flex-1 resize-none border-0 px-6 py-5 leading-[1.75] text-ink outline-none placeholder:text-ink-faint disabled:bg-surface-alt lg:px-8"
      />

      <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-t border-ink/[0.1] px-6 py-2.5 lg:px-8">
        <p
          aria-live="polite"
          className={cn(
            "text-[12.5px] font-semibold tabular-nums",
            short ? "text-ink-subtle" : "text-ok",
          )}
        >
          {words} {words === 1 ? "word" : "words"}
          <span className="text-ink-subtle">
            {short ? ` · ${minWords - words} below the minimum` : ` · minimum ${minWords} met`}
          </span>
        </p>

        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-2 rounded-[9px] bg-surface-alt px-3.5 py-2 text-[12.5px] font-bold text-ink-muted transition hover:bg-ink hover:text-white"
        >
          <DownloadIcon />
          Download
        </button>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}
