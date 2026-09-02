"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { PlayableTest } from "@/lib/tests/access";
import { cn } from "@/lib/utils";
import { formatClock, PlayerHeader } from "./PlayerChrome";
import { RichHtml } from "./SlotHtml";
import { ConfirmDialog } from "./SubmitDialog";
import { useCountdown } from "./useCountdown";
import { useRecorder } from "./useRecorder";
import { useTextSize } from "./useTextSize";
import type { AttemptSnapshot } from "./TestPlayer";

/**
 * The speaking test: one prompt at a time, recorded in the browser and uploaded
 * as it is finished. Nothing is graded here — the recordings go to the
 * instructor — so the screen's job is to run the clock honestly and never lose
 * a take.
 *
 * A mock follows the exam: the long turn gets its minute of preparation, every
 * answer stops at its limit, and there are no second attempts. Practice lets a
 * student re-record and listen back, which is the whole point of practising.
 */

type Phase = "briefing" | "prep" | "ready" | "recording" | "saving" | "finished";

type Saved = { id: string; durationSeconds: number | null };

export function SpeakingPlayer({
  test,
  attempt,
  canRequestReview,
}: {
  test: PlayableTest;
  attempt: AttemptSnapshot;
  /** Instructor marking is the paid part; free students still keep their work. */
  canRequestReview: boolean;
}) {
  const prompts = useMemo(() => test.content.prompts ?? [], [test.content.prompts]);
  const locked = attempt.mode === "MOCK";

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("briefing");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [saved, setSaved] = useState<Record<number, Saved>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const recorder = useRecorder();
  const { size, step, canDecrease, canIncrease } = useTextSize();

  const prompt = prompts[index];
  const isLast = index === prompts.length - 1;

  const remaining = deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));

  const upload = useCallback(
    async (blob: Blob, seconds: number) => {
      const form = new FormData();
      form.append("audio", blob, "answer");
      form.append("part", String(prompt.part));
      form.append("promptIndex", String(index));
      form.append("durationSeconds", String(seconds));

      const response = await fetch(`/api/attempts/${attempt.id}/recordings`, {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not save that answer.");
      }

      const data = (await response.json()) as { recording: Saved };
      return data.recording;
    },
    [attempt.id, index, prompt],
  );

  const finishAnswer = useCallback(async () => {
    setDeadline(null);
    const take = await recorder.stop();
    if (!take) {
      setPhase("ready");
      return;
    }

    setPhase("saving");
    setUploadError(null);

    try {
      const record = await upload(take.blob, take.seconds);
      setSaved((previous) => ({ ...previous, [index]: record }));
      setPhase("finished");
    } catch (error) {
      setUploadError((error as Error).message);
      setPhase("ready");
    }
  }, [index, recorder, upload]);

  const beginRecording = useCallback(async () => {
    setUploadError(null);
    const started = await recorder.start();
    if (!started) return;
    setPhase("recording");
    setDeadline(Date.now() + prompt.speakSeconds * 1000);
  }, [prompt, recorder]);

  /**
   * One ticker drives both clocks. The prep clock running out starts the long
   * turn; the speaking clock running out ends the answer. Both are the exam's
   * behaviour, not a convenience.
   *
   * The interval is cleared before firing, so a slow state update cannot let a
   * second tick stop the same answer twice.
   */
  useEffect(() => {
    if (deadline === null) return;
    if (phase !== "prep" && phase !== "recording") return;

    const timer = setInterval(() => {
      if (Date.now() >= deadline) {
        clearInterval(timer);
        if (phase === "prep") void beginRecording();
        else void finishAnswer();
        return;
      }
      setNow(Date.now());
    }, 250);

    return () => clearInterval(timer);
  }, [deadline, phase, beginRecording, finishAnswer]);

  const openPrompt = useCallback(
    (next: number) => {
      setIndex(next);
      setUploadError(null);
      const target = prompts[next];
      if (target.prepSeconds > 0 && !saved[next]) {
        setPhase("prep");
        setDeadline(Date.now() + target.prepSeconds * 1000);
      } else {
        setPhase(saved[next] ? "finished" : "ready");
        setDeadline(null);
      }
    },
    [prompts, saved],
  );

  const submit = useCallback(async (forReview: boolean) => {
    if (submitting || submitted) return;
    setSubmitting(true);

    try {
      const response = await fetch(`/api/attempts/${attempt.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forReview }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        window.alert(data?.error ?? "Could not submit. Please try again.");
        return;
      }
      setSubmitted(true);
      window.location.href = attempt.fullMockId
        ? "/full-mock"
        : `/dashboard/results/${attempt.id}`;
    } finally {
      setSubmitting(false);
    }
  }, [attempt.fullMockId, attempt.id, submitted, submitting]);

  const autoSubmit = useCallback(() => {
    void submit(canRequestReview);
  }, [canRequestReview, submit]);

  const testRemaining = useCountdown(attempt.expiresAt, submitted, autoSubmit, attempt.serverNow);
  const answered = Object.keys(saved).length;

  if (!prompt) {
    return <p className="p-8 text-sm text-ink-muted">This test has no prompts.</p>;
  }

  return (
    <div className="fixed inset-x-0 top-0 flex h-dvh flex-col overflow-hidden bg-surface-alt">
      <PlayerHeader
        title={test.title}
        subtitle={`${locked ? "Mock" : "Practice"} · ${prompts.length} questions`}
        exitHref={attempt.fullMockId ? "/full-mock" : `/tests?skill=${test.skill}`}
        remaining={testRemaining}
        totalSeconds={test.durationSeconds}
        saveStatus={phase === "saving" ? "saving" : answered > 0 ? "saved" : "idle"}
        textSize={size}
        onTextSize={step}
        canDecrease={canDecrease}
        canIncrease={canIncrease}
        onSubmit={() => setDialogOpen(true)}
        submitting={submitting}
      />

      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-3.5">
        <div className="flex w-full max-w-[760px] flex-col gap-3.5">
          {phase === "briefing" ? (
            <Briefing
              locked={locked}
              state={recorder.state}
              error={recorder.error}
              onArm={async () => {
                if (await recorder.arm()) openPrompt(0);
              }}
            />
          ) : (
            <>
              <PromptCard
                prompt={prompt}
                index={index}
                total={prompts.length}
                fontSize={size}
                phase={phase}
                remaining={remaining}
              />

              <Controls
                phase={phase}
                locked={locked}
                elapsed={recorder.elapsed}
                remaining={remaining}
                speakSeconds={prompt.speakSeconds}
                recorded={saved[index]}
                attemptId={attempt.id}
                error={uploadError ?? recorder.error}
                isLast={isLast}
                onStartEarly={() => {
                  setDeadline(null);
                  void beginRecording();
                }}
                onRecord={() => void beginRecording()}
                onStop={() => void finishAnswer()}
                onNext={() => openPrompt(index + 1)}
                onFinish={() => setDialogOpen(true)}
                onSkip={() => {
                  setDeadline(null);
                  if (isLast) setDialogOpen(true);
                  else openPrompt(index + 1);
                }}
              />
            </>
          )}
        </div>
      </div>

      {phase !== "briefing" && (
        <ProgressStrip
          prompts={prompts}
          index={index}
          saved={saved}
          locked={locked}
          onSelect={openPrompt}
        />
      )}

      <ConfirmDialog
        open={dialogOpen}
        eyebrow="FINISH TEST"
        title={
          answered === prompts.length
            ? "Every question is recorded."
            : `${prompts.length - answered} question${prompts.length - answered === 1 ? "" : "s"} not recorded.`
        }
        confirmLabel={canRequestReview ? "Send to my instructor" : "Finish and keep my answers"}
        confirmingLabel="Finishing…"
        cancelLabel="Keep going"
        submitting={submitting}
        onConfirm={() => void submit(canRequestReview)}
        onCancel={() => setDialogOpen(false)}
        secondaryLabel={canRequestReview ? "Finish without sending" : undefined}
        onSecondary={canRequestReview ? () => void submit(false) : undefined}
      >
        <p className="mt-5 text-sm leading-relaxed text-ink-muted">
          {canRequestReview
            ? "Speaking is marked by a person, so there is no band straight away. Send it and it appears on your dashboard once your instructor has listened — or finish without sending and keep the recordings to yourself."
            : "Your recordings are saved to your dashboard either way. Marking by your instructor is part of premium; ask them to unlock it if you would like a band."}
        </p>
      </ConfirmDialog>
    </div>
  );
}

function Briefing({
  locked,
  state,
  error,
  onArm,
}: {
  locked: boolean;
  state: string;
  error: string | null;
  onArm: () => void;
}) {
  return (
    <section className="rounded-xl bg-white p-7 shadow-[0_1px_2px_rgba(11,17,32,.08)] lg:p-9">
      <p className="text-[10px] font-bold tracking-[0.22em] text-ink-subtle">BEFORE YOU START</p>
      <h2 className="mt-3 font-display text-2xl leading-[1.1] tracking-[-0.02em] text-ink">
        Check your microphone.
      </h2>

      <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-ink-muted">
        Your browser will ask for permission to record. Answers are uploaded one at a time as you
        finish them, so nothing is lost if the page closes part way through.
      </p>

      <ul className="mt-5 space-y-2 text-sm text-ink-muted">
        <Rule>Part 2 gives you one minute to prepare before you speak.</Rule>
        <Rule>Each answer stops on its own when the time is up.</Rule>
        <Rule>
          {locked
            ? "This is a mock: you cannot re-record an answer or listen back until you finish."
            : "This is practice: you can re-record any answer and listen back."}
        </Rule>
      </ul>

      {error && <p className="mt-5 text-sm font-semibold text-brand-red-cta">{error}</p>}

      <button
        type="button"
        onClick={onArm}
        disabled={state === "requesting" || state === "unsupported"}
        className="mt-7 rounded-[10px] bg-ink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-ink/85 disabled:opacity-50"
      >
        {state === "requesting" ? "Waiting for permission…" : "Allow microphone and begin"}
      </button>
    </section>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-brand-red" />
      <span>{children}</span>
    </li>
  );
}

function PromptCard({
  prompt,
  index,
  total,
  fontSize,
  phase,
  remaining,
}: {
  prompt: NonNullable<PlayableTest["content"]["prompts"]>[number];
  index: number;
  total: number;
  fontSize: number;
  phase: Phase;
  remaining: number | null;
}) {
  const cueCard = prompt.bulletsHtml && prompt.bulletsHtml.length > 0;

  return (
    <section className="rounded-xl bg-white p-6 shadow-[0_1px_2px_rgba(11,17,32,.08)] lg:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[10px] font-bold tracking-[0.22em] text-brand-blue">
          PART {prompt.part}
        </p>
        <p className="text-[11.5px] font-semibold text-ink-subtle tabular-nums">
          Question {index + 1} of {total}
        </p>
      </div>

      {phase === "prep" && remaining !== null && (
        <p className="mt-4 rounded-lg bg-brand-blue-soft px-4 py-3 text-sm font-semibold text-brand-blue">
          Preparation time — {formatClock(remaining)} left. Make notes if you want to.
        </p>
      )}

      <div style={{ fontSize }} className="mt-5">
        <RichHtml
          html={prompt.promptHtml}
          className={cn(
            "leading-relaxed text-ink",
            // The examiner's framing sentence is context, not the question.
            "[&_.frame]:mb-2 [&_.frame]:text-[0.8em] [&_.frame]:font-semibold [&_.frame]:uppercase [&_.frame]:tracking-[0.08em] [&_.frame]:text-ink-subtle",
            cueCard && "[&>p:not(.frame)]:font-display [&>p:not(.frame)]:text-[1.25em]",
          )}
        />

        {cueCard && (
          <div className="mt-5 border-l-2 border-brand-red pl-4">
            <p className="text-[0.82em] font-bold tracking-[0.1em] text-ink-subtle">
              YOU SHOULD SAY
            </p>
            <ul className="mt-2 space-y-1.5 text-ink">
              {prompt.bulletsHtml?.map((bullet, position) => (
                <li key={position} className="leading-relaxed">
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Controls({
  phase,
  locked,
  elapsed,
  remaining,
  speakSeconds,
  recorded,
  attemptId,
  error,
  isLast,
  onStartEarly,
  onRecord,
  onStop,
  onNext,
  onFinish,
  onSkip,
}: {
  phase: Phase;
  locked: boolean;
  elapsed: number;
  remaining: number | null;
  speakSeconds: number;
  recorded: Saved | undefined;
  attemptId: string;
  error: string | null;
  isLast: boolean;
  onStartEarly: () => void;
  onRecord: () => void;
  onStop: () => void;
  onNext: () => void;
  onFinish: () => void;
  onSkip: () => void;
}) {
  return (
    <section className="rounded-xl bg-white p-6 shadow-[0_1px_2px_rgba(11,17,32,.08)] lg:p-8">
      {error && <p className="mb-4 text-sm font-semibold text-brand-red-cta">{error}</p>}

      {phase === "prep" && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onStartEarly}
            className="rounded-[10px] bg-ink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-ink/85"
          >
            Start speaking now
          </button>
          <p className="text-[12.5px] text-ink-subtle">
            Or wait for the preparation time to run out.
          </p>
          <SkipButton onClick={onSkip} />
        </div>
      )}

      {phase === "ready" && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onRecord}
            className="inline-flex items-center gap-2.5 rounded-[10px] bg-brand-red-cta px-6 py-3.5 text-sm font-bold text-white shadow-[0_14px_26px_-12px_rgba(225,0,70,.7)] transition hover:bg-brand-red-dark"
          >
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-white" />
            {recorded ? "Record again" : "Record answer"}
          </button>
          <p className="text-[12.5px] text-ink-subtle tabular-nums">
            You have {formatClock(speakSeconds)} to answer.
          </p>
          <SkipButton onClick={onSkip} />
        </div>
      )}

      {phase === "recording" && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-2.5 rounded-[10px] bg-ink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-ink/85"
          >
            <span aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-white" />
            Stop
          </button>

          <p
            aria-live="off"
            className="inline-flex items-center gap-2.5 text-sm font-bold text-brand-red-cta tabular-nums"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 animate-[var(--animate-pulse-slow)] rounded-full bg-brand-red-cta"
            />
            Recording {formatClock(elapsed)}
            {remaining !== null && (
              <span className="font-semibold text-ink-subtle">
                · {formatClock(remaining)} left
              </span>
            )}
          </p>
        </div>
      )}

      {phase === "saving" && <p className="text-sm font-semibold text-ink-muted">Saving answer…</p>}

      {phase === "finished" && recorded && (
        <div className="flex flex-wrap items-center gap-4">
          {/* A mock does not let a student hear themselves before the end; that
              would be a second attempt in everything but name. */}
          {!locked && (
            <audio
              controls
              preload="none"
              src={`/api/attempts/${attemptId}/recordings/${recorded.id}`}
              className="h-10 min-w-[240px] flex-1"
            />
          )}

          {locked && (
            <p className="flex-1 text-sm font-semibold text-ok">
              Answer recorded
              {recorded.durationSeconds ? ` · ${formatClock(recorded.durationSeconds)}` : ""}.
            </p>
          )}

          {!locked && (
            <button
              type="button"
              onClick={onRecord}
              className="rounded-[10px] bg-surface-alt px-5 py-3 text-sm font-bold text-ink transition hover:bg-ink hover:text-white"
            >
              Record again
            </button>
          )}

          <button
            type="button"
            onClick={isLast ? onFinish : onNext}
            className="rounded-[10px] bg-ink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-ink/85"
          >
            {isLast ? "Finish test" : "Next question"}
          </button>
        </div>
      )}
    </section>
  );
}

/** Every question at a glance: done, current, still to come. */
/**
 * Moving on without answering.
 *
 * Practice is not the exam: a student working through Part 3 at their desk
 * should be able to read a question, decide it is not the one they want to
 * rehearse, and move on. Nothing is required before finishing.
 */
function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto rounded-[9px] px-3.5 py-2 text-[12.5px] font-bold text-ink-subtle underline-offset-4 transition hover:text-ink hover:underline"
    >
      Skip this question →
    </button>
  );
}

function ProgressStrip({
  prompts,
  index,
  saved,
  locked,
  onSelect,
}: {
  prompts: NonNullable<PlayableTest["content"]["prompts"]>;
  index: number;
  saved: Record<number, Saved>;
  locked: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <nav
      aria-label="Question progress"
      className="flex-none border-t border-ink/[0.12] bg-white px-4 py-2.5 lg:px-[22px]"
    >
      <ul className="flex items-center gap-1 overflow-x-auto">
        {prompts.map((prompt, position) => {
          const done = Boolean(saved[position]);
          const current = position === index;
          // A mock cannot revisit an answered question, so those chips are inert.
          const reachable = !locked || (!done && position <= index);

          return (
            <li key={position} className="flex flex-none items-center gap-1">
              {position > 0 && prompt.part !== prompts[position - 1].part && (
                <span aria-hidden className="mx-1.5 h-[26px] w-px bg-ink/[0.14]" />
              )}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(position)}
                aria-current={current ? "true" : undefined}
                aria-label={`Question ${position + 1}, part ${prompt.part}${done ? ", recorded" : ""}`}
                className={cn(
                  "flex h-[30px] w-[30px] items-center justify-center rounded text-[12px] font-bold transition",
                  done && "bg-ok text-white",
                  !done && "bg-white text-ink shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.22)]",
                  current && "bg-brand-blue text-white shadow-none",
                  !reachable && "cursor-not-allowed opacity-45",
                )}
              >
                {position + 1}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
