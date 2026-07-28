import { bandForRawScore, type GradedSkill } from "./bands";
import { countWords, isBlank, normalizeAnswer } from "./normalize";
import { groupByQuestionNumber, partByQuestionNumber } from "./slots";
import type { AnswerSet, TestAnswerKey, TestContent } from "./schema";

/** Raw submission shape: question number (as string) to what the student typed. */
export type Submission = Record<string, string>;

export type QuestionVerdict = {
  number: number;
  part: number | null;
  correct: boolean;
  submitted: string;
  /** Canonical accepted answer, for the review screen. */
  expected: string;
  allAccepted: string[];
  type?: string;
  explanation?: string;
  evidence?: { anchor?: string; snippet?: string };
  /** Set when a right answer was rejected for breaking the rubric word limit. */
  overWordLimit?: boolean;
  /** Questions graded together as one unordered set, if any. */
  setWith?: number[];
};

export type GradeResult = {
  rawScore: number;
  totalQuestions: number;
  band: number;
  scaledScore: number;
  isEstimate: boolean;
  verdicts: QuestionVerdict[];
};

function setForQuestion(key: TestAnswerKey, number: number): AnswerSet | undefined {
  return key.sets.find((set) => set.questions.includes(number));
}

/**
 * Grades a submission against the answer key.
 *
 * `content` is needed as well as the key so word limits from the rubric can be
 * enforced the way examiners do: an answer that contains the right words but
 * exceeds "ONE WORD ONLY" is marked wrong.
 */
export function gradeSubmission(
  content: TestContent,
  key: TestAnswerKey,
  submission: Submission,
): GradeResult {
  const skill = content.skill as GradedSkill;
  const groups = groupByQuestionNumber(content);
  const parts = partByQuestionNumber(content);
  const verdicts: QuestionVerdict[] = [];

  // A "choose TWO letters" set is scored once and its result applied to every
  // question number it covers, so partial credit works: two right letters in
  // either order earn both marks, one right letter earns one.
  const setScores = new Map<AnswerSet, boolean[]>();
  for (const set of key.sets) {
    const submitted = set.questions
      .map((number) => submission[String(number)] ?? "")
      .filter((value) => !isBlank(value))
      .map(normalizeAnswer);

    const remaining = set.accepted.map(normalizeAnswer);
    const unique = new Set<string>();
    let hits = 0;
    for (const value of submitted) {
      if (unique.has(value)) continue;
      unique.add(value);
      const index = remaining.indexOf(value);
      if (index !== -1) {
        remaining.splice(index, 1);
        hits += 1;
      }
    }

    setScores.set(
      set,
      set.questions.map((_, position) => position < hits),
    );
  }

  for (let number = 1; number <= content.totalQuestions; number += 1) {
    const raw = submission[String(number)] ?? "";
    const part = parts.get(number) ?? null;
    const group = groups.get(number);
    const set = setForQuestion(key, number);

    if (set) {
      const positions = setScores.get(set) ?? [];
      const position = set.questions.indexOf(number);
      verdicts.push({
        number,
        part,
        correct: positions[position] ?? false,
        submitted: raw.trim(),
        expected: set.accepted.join(" + "),
        allAccepted: set.accepted,
        type: set.type,
        explanation: set.explanation,
        evidence: set.evidence,
        setWith: set.questions.filter((q) => q !== number),
      });
      continue;
    }

    const entry = key.answers[String(number)];
    if (!entry) {
      // The validator refuses to publish a test in this state; grading a draft
      // should still produce a full verdict list rather than throw.
      verdicts.push({
        number,
        part,
        correct: false,
        submitted: raw.trim(),
        expected: "",
        allAccepted: [],
      });
      continue;
    }

    const answered = !isBlank(raw);
    const matched =
      answered &&
      entry.accepted.some((candidate) => normalizeAnswer(candidate) === normalizeAnswer(raw));

    const limit = group?.maxWords;
    const withinLimit = !limit || !answered || countWords(raw) <= limit;
    // Right words but too many of them. Worth telling the student apart from a
    // plain wrong answer, since it is the rubric they missed, not the content.
    const overWordLimit = matched && !withinLimit;

    verdicts.push({
      number,
      part,
      correct: matched && withinLimit,
      submitted: raw.trim(),
      expected: entry.accepted[0],
      allAccepted: entry.accepted,
      type: entry.type,
      explanation: entry.explanation,
      evidence: entry.evidence,
      ...(overWordLimit ? { overWordLimit: true } : {}),
    });
  }

  const rawScore = verdicts.filter((verdict) => verdict.correct).length;
  const { band, scaledScore, isEstimate } = bandForRawScore(
    skill,
    rawScore,
    content.totalQuestions,
  );

  return {
    rawScore,
    totalQuestions: content.totalQuestions,
    band,
    scaledScore,
    isEstimate,
    verdicts,
  };
}

/**
 * Builds the submission a flawless student would produce, using the canonical
 * accepted answer for every question. The validator runs this back through
 * gradeSubmission and requires full marks — which is what catches a key whose
 * question numbers have drifted out of step with the content's slots.
 */
export function perfectSubmission(key: TestAnswerKey): Submission {
  const submission: Submission = {};

  for (const [number, entry] of Object.entries(key.answers)) {
    submission[number] = entry.accepted[0];
  }

  for (const set of key.sets) {
    set.questions.forEach((number, position) => {
      submission[String(number)] = set.accepted[position] ?? set.accepted[0];
    });
  }

  return submission;
}
