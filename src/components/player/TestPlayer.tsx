"use client";

import { useCallback, useMemo, useState } from "react";

import type { PlayableTest } from "@/lib/tests/access";
import type { GradeResult } from "@/lib/tests/grade";
import { questionNumbersInGroup } from "@/lib/tests/slots";
import type { Annotations } from "@/lib/player/highlights";
import { AudioBar } from "./AudioBar";
import { Notepad } from "./Notepad";
import { PassagePane, type Evidence, type EvidenceMark } from "./PassagePane";
import { useAnnotations } from "./useAnnotations";
import { PlayerHeader, ReviewHeader } from "./PlayerChrome";
import { QuestionGroupView, type ReviewInfo } from "./QuestionGroupView";
import { QuestionNav, type NavPart } from "./QuestionNav";
import { ScoreReveal } from "./ScoreReveal";
import { RichHtml } from "./SlotHtml";
import { SplitView } from "./SplitView";
import { SubmitDialog } from "./SubmitDialog";
import { useAutosave } from "./useAutosave";
import { useCountdown } from "./useCountdown";
import { useTextSize } from "./useTextSize";

export type AttemptSnapshot = {
  id: string;
  mode: "PRACTICE" | "MOCK";
  startedAt: string;
  expiresAt: string | null;
  answers: Record<string, string>;
  flags: number[];
  /** Highlights and notes. The server stores this without interpreting it. */
  annotations: Annotations;
  /** Set when this attempt is one section of a full mock. */
  fullMockId: string | null;
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
  const [scoreOpen, setScoreOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [evidence, setEvidence] = useState<Evidence | null>(null);

  const { queue, flush, status } = useAutosave(attempt.id);
  const { size, step, canDecrease, canIncrease } = useTextSize();
  const reviewMode = result !== null;

  const saveAnnotations = useCallback(
    (annotations: Annotations) => queue({ annotations }),
    [queue],
  );
  const notes = useAnnotations(attempt.annotations ?? {}, saveAnnotations);

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

  // In review, every answer's location, so the passage can badge them all at
  // once — a wrong answer's badge is red, which is the "where I went wrong" part.
  const evidenceMarks = useMemo<EvidenceMark[] | undefined>(() => {
    if (!reviewMode) return undefined;
    const marks: EvidenceMark[] = [];
    for (const part of navParts) {
      for (const number of part.questions) {
        const info = reviewFor(number);
        if (info?.evidence?.snippet) {
          marks.push({ n: number, snippet: info.evidence.snippet, correct: info.correct });
        }
      }
    }
    return marks;
  }, [reviewMode, navParts, reviewFor]);

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

      // Mid-mock there is another section waiting, so marking is deferred to
      // the end rather than opened in place — a student should not be reading
      // explanations with the reading clock about to start.
      if (attempt.fullMockId) {
        window.location.href = "/full-mock";
        return;
      }

      // No router.refresh(): the attempt page redirects a submitted attempt to
      // the results page, which would pull the student away from the passage
      // just as the marking appears.
      setResult(await response.json());
      setDialogOpen(false);
      // The band leads; the marked paper is behind it.
      setScoreOpen(true);
      window.scrollTo({ top: 0 });
    } finally {
      setSubmitting(false);
    }
  }, [answers, attempt.fullMockId, attempt.id, flush, reviewMode, submitting]);

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

  // In a mock the student should not know which Volume or Test they drew — on
  // the day there is no such label, and knowing it invites looking the paper up
  // afterwards. The real title comes back in review, once the paper is marked.
  const displayTitle =
    attempt.mode === "MOCK" && !reviewMode
      ? `IELTS ${test.skill === "listening" ? "Listening" : "Reading"}`
      : test.title;

  const answeredCount = navParts
    .flatMap((part) => part.questions)
    .filter((question) => (answers[String(question)] ?? "").trim()).length;

  // Back where the student came from: the skill they were browsing, or the mock
  // they are part way through. Landing on the undifferentiated list after a
  // reading test means finding the reading tests again by hand.
  const exitHref = attempt.fullMockId ? "/full-mock" : `/tests?skill=${test.skill}`;

  // Part offsets are optional in the schema; without them the track just has no
  // markers on it.
  const audioMarkers = parts
    .filter((part) => part.audioStartSeconds !== undefined)
    .map((part) => ({ number: part.number, startSeconds: part.audioStartSeconds! }));

  const questionsPane = (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:px-8" style={{ fontSize: size }}>
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
    // `overflow-hidden`: the player owns the viewport and scrolls inside its own
    // panes. Nothing should ever be able to scroll the document behind it.
    <div className="fixed inset-x-0 top-0 flex h-dvh flex-col overflow-hidden bg-surface-alt">
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
          title={displayTitle}
          subtitle={`${attempt.mode === "MOCK" ? "Mock" : "Practice"} · ${test.totalQuestions} questions`}
          exitHref={exitHref}
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

      {test.skill === "listening" && test.hasAudio && (
        <AudioBar
          src={`/api/tests/${test.id}/audio`}
          // Mock rules apply only while the test is live. In review the point is
          // to study the recording, so the controls come back.
          locked={attempt.mode === "MOCK" && !reviewMode}
          knownDuration={test.audioDurationSeconds}
          parts={audioMarkers}
        />
      )}

      {/* The part's own instructions run full width above both panes, where the
          real test puts them — they govern the passage and the questions
          equally, and inside one pane they read as a caption on that pane. */}
      {currentPart?.instructionsHtml && (
        <div className="flex-none px-3.5 pt-3.5">
          <RichHtml
            html={currentPart.instructionsHtml}
            // Kept tight on purpose: every pixel here is a pixel of question
            // pane, and on a laptop the two are competing for the same screen.
            className="rounded-xl bg-white px-5 py-2.5 text-[13px] leading-snug text-ink-muted shadow-[0_1px_2px_rgba(11,17,32,.08)] [&_h3]:mb-0.5 [&_h3]:text-[14.5px] [&_h3]:font-bold [&_h3]:text-ink [&_p+p]:mt-1 [&_strong]:text-ink"
          />
        </div>
      )}

      {currentPart?.passageHtml ? (
        <SplitView
          leftLabel="Passage"
          rightLabel="Questions"
          left={
            <PassagePane
              html={currentPart.passageHtml}
              evidence={evidence}
              evidenceMarks={evidenceMarks}
              focusQuestion={reviewMode ? activeQuestion : null}
              fontSize={size}
              part={currentPart.number}
              highlights={notes.highlights}
              onAddHighlight={notes.addHighlight}
              onRemoveHighlight={notes.removeHighlight}
              onSetNote={notes.setNote}
            />
          }
          right={questionsPane}
        />
      ) : (
        <div className="relative flex min-h-0 flex-1 p-3.5">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(11,17,32,.08)]">
            {questionsPane}
          </div>

          {/* No passage to highlight, so the notes live in a pad instead. */}
          <Notepad
            value={notes.scratchpad}
            onChange={notes.setScratchpad}
            disabled={reviewMode}
          />
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

      {result && (
        <ScoreReveal
          open={scoreOpen}
          skillLabel={test.skill === "listening" ? "Listening" : "Reading"}
          band={result.band}
          rawScore={result.rawScore}
          totalQuestions={result.totalQuestions}
          isEstimate={result.isEstimate}
          resultsHref={`/dashboard/results/${attempt.id}`}
          onClose={() => setScoreOpen(false)}
        />
      )}
    </div>
  );
}
