"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PlayableTest } from "@/lib/tests/access";
import type { GradeResult } from "@/lib/tests/grade";
import { questionNumbersInGroup } from "@/lib/tests/slots";
import { PassagePane, type Evidence } from "./PassagePane";
import { PlayerHeader, ReviewHeader } from "./PlayerChrome";
import { QuestionGroupView, type ReviewInfo } from "./QuestionGroupView";
import { QuestionNav, type NavPart } from "./QuestionNav";
import { RichHtml } from "./SlotHtml";
import { SplitView } from "./SplitView";
import { SubmitDialog } from "./SubmitDialog";
import { useAutosave } from "./useAutosave";
import { useTextSize } from "./useTextSize";

export type AttemptSnapshot = {
  id: string;
  mode: "PRACTICE" | "MOCK";
  startedAt: string;
  expiresAt: string | null;
  answers: Record<string, string>;
  flags: number[];
};

export function TestPlayer({
  test,
  attempt,
}: {
  test: PlayableTest;
  attempt: AttemptSnapshot;
}) {
  const parts = useMemo(() => test.content.parts ?? [], [test.content.parts]);

  const [answers, setAnswers] = useState<Record<string, string>>(attempt.answers ?? {});
  const [flags, setFlags] = useState<number[]>(attempt.flags ?? []);
  const [activePart, setActivePart] = useState(parts[0]?.number ?? 1);
  const [activeQuestion, setActiveQuestion] = useState(1);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [evidence, setEvidence] = useState<Evidence | null>(null);

  const { queue, flush, status } = useAutosave(attempt.id);
  const { size, step, canDecrease, canIncrease } = useTextSize();
  const reviewMode = result !== null;

  const navParts: NavPart[] = useMemo(
    () =>
      parts.map((part) => ({
        number: part.number,
        questions: [
          ...new Set(part.groups.flatMap((group) => questionNumbersInGroup(group))),
        ].sort((a, b) => a - b),
      })),
    [parts],
  );

  const reviewFor = useCallback(
    (questionNumber: number): ReviewInfo | undefined => {
      if (!result) return undefined;
      const verdict = result.verdicts.find((entry) => entry.number === questionNumber);
      if (!verdict) return undefined;
      return {
        correct: verdict.correct,
        expected: verdict.expected,
        allAccepted: verdict.allAccepted,
        submitted: verdict.submitted,
        explanation: verdict.explanation,
        evidence: verdict.evidence,
        overWordLimit: verdict.overWordLimit,
      };
    },
    [result],
  );

  const verdictFor = useCallback(
    (questionNumber: number) => {
      const review = reviewFor(questionNumber);
      if (!review) return undefined;
      return review.correct ? ("correct" as const) : ("incorrect" as const);
    },
    [reviewFor],
  );

  const handleAnswer = useCallback(
    (questionNumber: number, value: string) => {
      setAnswers((previous) => ({ ...previous, [String(questionNumber)]: value }));
      queue({ answers: { [String(questionNumber)]: value } });
    },
    [queue],
  );

  const handleToggleFlag = useCallback(
    (questionNumber: number) => {
      setFlags((previous) => {
        const next = previous.includes(questionNumber)
          ? previous.filter((value) => value !== questionNumber)
          : [...previous, questionNumber];
        queue({ flags: next });
        return next;
      });
    },
    [queue],
  );

  const submit = useCallback(async () => {
    if (submitting || reviewMode) return;

    setSubmitting(true);
    await flush();

    try {
      const response = await fetch(`/api/attempts/${attempt.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        window.alert(data?.error ?? "Could not submit. Please try again.");
        return;
      }

      // No router.refresh(): the attempt page redirects a submitted attempt to
      // the results page, which would pull the student away from the passage
      // just as the marking appears.
      setResult(await response.json());
      setDialogOpen(false);
      window.scrollTo({ top: 0 });
    } finally {
      setSubmitting(false);
    }
  }, [answers, attempt.id, flush, reviewMode, submitting]);

  const goToQuestion = useCallback(
    (questionNumber: number) => {
      setActiveQuestion(questionNumber);
      const owner = navParts.find((part) => part.questions.includes(questionNumber));
      if (owner) setActivePart(owner.number);

      requestAnimationFrame(() => {
        const target = document.getElementById(`q${questionNumber}`);
        target?.scrollIntoView({ block: "center", behavior: "smooth" });
        if (target instanceof HTMLInputElement) target.focus();
      });
    },
    [navParts],
  );

  const remaining = useCountdown(attempt.expiresAt, reviewMode, submit);
  const currentPart = parts.find((part) => part.number === activePart) ?? parts[0];

  const answeredCount = navParts
    .flatMap((part) => part.questions)
    .filter((question) => (answers[String(question)] ?? "").trim()).length;

  const questionsPane = (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:px-8" style={{ fontSize: size }}>
      {!currentPart?.passageHtml && currentPart?.instructionsHtml && (
        <RichHtml
          html={currentPart.instructionsHtml}
          className="mb-5 border-l-2 border-brand-red pl-4 text-sm text-ink-muted [&_h3]:font-display [&_h3]:text-base [&_h3]:text-ink"
        />
      )}

      {currentPart?.groups.map((group) => (
        <QuestionGroupView
          key={group.id}
          group={group}
          answers={answers}
          flags={flags}
          activeQuestion={activeQuestion}
          reviewMode={reviewMode}
          reviewFor={reviewFor}
          onAnswer={handleAnswer}
          onFocusQuestion={setActiveQuestion}
          onToggleFlag={handleToggleFlag}
          onShowEvidence={currentPart?.passageHtml ? setEvidence : undefined}
        />
      ))}
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-surface-alt">
      {reviewMode && result ? (
        <ReviewHeader
          title={test.title}
          submittedAt={new Date().toLocaleString(undefined, {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
          timeUsed={null}
          rawScore={result.rawScore}
          totalQuestions={result.totalQuestions}
          band={result.band}
          isEstimate={result.isEstimate}
        />
      ) : (
        <PlayerHeader
          title={test.title}
          subtitle={`${attempt.mode === "MOCK" ? "Mock" : "Practice"} · ${test.totalQuestions} questions`}
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
      )}

      {currentPart?.passageHtml ? (
        <SplitView
          leftLabel="Passage"
          rightLabel="Questions"
          left={
            <PassagePane
              html={currentPart.passageHtml}
              instructionsHtml={currentPart.instructionsHtml}
              evidence={evidence}
              fontSize={size}
            />
          }
          right={questionsPane}
        />
      ) : (
        <div className="flex min-h-0 flex-1 p-3.5">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(11,17,32,.08)]">
            {questionsPane}
          </div>
        </div>
      )}

      <QuestionNav
        parts={navParts}
        activePart={activePart}
        activeQuestion={activeQuestion}
        answers={answers}
        flags={flags}
        verdictFor={verdictFor}
        reviewMode={reviewMode}
        onSelectQuestion={goToQuestion}
      />

      <SubmitDialog
        open={dialogOpen}
        answered={answeredCount}
        total={test.totalQuestions}
        flagged={flags.length}
        submitting={submitting}
        onConfirm={submit}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}

/**
 * Seconds left, measured against the server's deadline rather than counted down
 * locally, so a backgrounded tab cannot drift. Only the clock is state; the
 * remaining time is derived during render.
 */
function useCountdown(expiresAt: string | null, frozen: boolean, onExpire: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);

  useEffect(() => {
    if (!expiresAt || frozen) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt, frozen]);

  const remaining = expiresAt
    ? Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000))
    : null;

  useEffect(() => {
    if (remaining === 0 && !fired.current) {
      fired.current = true;
      onExpire();
    }
  }, [remaining, onExpire]);

  return remaining;
}
