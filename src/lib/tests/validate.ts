import { gradeSubmission, perfectSubmission } from "./grade";
import { countWords, normalizeAnswer } from "./normalize";
import { questionNumbersInContent, slotNumbersIn } from "./slots";
import {
  testImportSchema,
  type TestAnswerKey,
  type TestContent,
  type TestImport,
} from "./schema";

export type ValidationIssue = {
  /** Errors block publishing. Warnings are shown but can be accepted. */
  level: "error" | "warning";
  code: string;
  message: string;
  questionNumber?: number;
};

export type ValidationReport = {
  ok: boolean;
  issues: ValidationIssue[];
  parsed?: TestImport;
  stats?: {
    skill: string;
    totalQuestions: number;
    questionsCovered: number;
    parts: number;
    groups: number;
    selfTestScore?: string;
  };
};

/** Rubric phrasing that implies the answer is lifted verbatim from the passage. */
const FROM_PASSAGE = /\b(from the (?:passage|text)|from the (?:reading )?text)\b/i;
/**
 * Order matters: "AND/OR A NUMBER" allows one extra token, so those phrasings
 * must be tested before the plainer ones they contain. Kept in step with
 * maxWordsFromRubric in the conversion scripts.
 */
const WORD_LIMIT_PHRASES: Array<{ pattern: RegExp; maxWords: number }> = [
  { pattern: /\bNO MORE THAN THREE WORDS AND\/?OR A NUMBER\b/i, maxWords: 4 },
  { pattern: /\bNO MORE THAN TWO WORDS AND\/?OR A NUMBER\b/i, maxWords: 3 },
  { pattern: /\bNO MORE THAN ONE WORD AND\/?OR A NUMBER\b/i, maxWords: 2 },
  { pattern: /\bONE WORD AND\/?OR A NUMBER\b/i, maxWords: 2 },
  { pattern: /\bONE WORD ONLY\b/i, maxWords: 1 },
  { pattern: /\bNO MORE THAN ONE WORD\b/i, maxWords: 1 },
  { pattern: /\bNO MORE THAN TWO WORDS\b/i, maxWords: 2 },
  { pattern: /\bTWO WORDS ONLY\b/i, maxWords: 2 },
  { pattern: /\bNO MORE THAN THREE WORDS\b/i, maxWords: 3 },
  { pattern: /\bTHREE WORDS ONLY\b/i, maxWords: 3 },
];

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function checkQuestionCoverage(content: TestContent, issues: ValidationIssue[]): number[] {
  const covered = questionNumbersInContent(content);
  const seen = new Set<number>();

  for (const number of covered) {
    if (seen.has(number)) {
      issues.push({
        level: "error",
        code: "duplicate_question",
        message: `Question ${number} appears more than once in the content`,
        questionNumber: number,
      });
    }
    seen.add(number);
  }

  for (let number = 1; number <= content.totalQuestions; number += 1) {
    if (!seen.has(number)) {
      issues.push({
        level: "error",
        code: "missing_question",
        message: `Question ${number} is declared in totalQuestions but has no slot or item in the content`,
        questionNumber: number,
      });
    }
  }

  for (const number of seen) {
    if (number > content.totalQuestions) {
      issues.push({
        level: "error",
        code: "question_out_of_range",
        message: `Question ${number} is in the content but totalQuestions is ${content.totalQuestions}`,
        questionNumber: number,
      });
    }
  }

  return covered;
}

function checkAnswerKeyCoverage(
  content: TestContent,
  key: TestAnswerKey,
  issues: ValidationIssue[],
) {
  const singles = new Set(Object.keys(key.answers).map(Number));
  const inSets = new Map<number, number>();

  for (const set of key.sets) {
    if (set.questions.length !== set.accepted.length) {
      issues.push({
        level: "error",
        code: "set_length_mismatch",
        message: `Answer set ${set.questions.join("/")} covers ${set.questions.length} questions but lists ${set.accepted.length} accepted answers`,
      });
    }
    for (const number of set.questions) {
      inSets.set(number, (inSets.get(number) ?? 0) + 1);
    }
  }

  for (let number = 1; number <= content.totalQuestions; number += 1) {
    const hasSingle = singles.has(number);
    const setCount = inSets.get(number) ?? 0;

    if (!hasSingle && setCount === 0) {
      issues.push({
        level: "error",
        code: "missing_answer",
        message: `Question ${number} has no entry in the answer key`,
        questionNumber: number,
      });
    }
    if (hasSingle && setCount > 0) {
      issues.push({
        level: "error",
        code: "duplicate_answer",
        message: `Question ${number} is in both answers and an answer set`,
        questionNumber: number,
      });
    }
    if (setCount > 1) {
      issues.push({
        level: "error",
        code: "duplicate_answer",
        message: `Question ${number} appears in ${setCount} answer sets`,
        questionNumber: number,
      });
    }
  }

  for (const number of singles) {
    if (number < 1 || number > content.totalQuestions) {
      issues.push({
        level: "error",
        code: "orphan_answer",
        message: `The answer key has an entry for question ${number}, which is outside 1-${content.totalQuestions}`,
        questionNumber: number,
      });
    }
  }
}

function checkWordBankReferences(
  content: TestContent,
  key: TestAnswerKey,
  issues: ValidationIssue[],
) {
  for (const part of content.parts ?? []) {
    for (const group of part.groups) {
      if (!group.wordBank || group.wordBank.length === 0) continue;

      const letters = new Set(group.wordBank.map((item) => item.letter.toUpperCase()));
      const numbers = group.bodyHtml
        ? slotNumbersIn(group.bodyHtml)
        : (group.questions ?? []).map((question) => question.number);

      for (const number of numbers) {
        const accepted =
          key.answers[String(number)]?.accepted ??
          key.sets.find((set) => set.questions.includes(number))?.accepted ??
          [];

        // A letter answer is a single character; anything longer is a spelled-out
        // variant the converter added alongside it, which is fine.
        const letterAnswers = accepted.filter((value) => value.trim().length === 1);
        for (const value of letterAnswers) {
          if (!letters.has(value.trim().toUpperCase())) {
            issues.push({
              level: "error",
              code: "unknown_wordbank_letter",
              message: `Question ${number} expects letter "${value}" but group "${group.id}" has no such option`,
              questionNumber: number,
            });
          }
        }
      }
    }
  }
}

function checkMcqOptionsMatchKey(
  content: TestContent,
  key: TestAnswerKey,
  issues: ValidationIssue[],
) {
  for (const part of content.parts ?? []) {
    for (const group of part.groups) {
      if (group.type !== "mcq") continue;

      for (const question of group.questions ?? []) {
        const letters = new Set(
          (question.options ?? []).map((option) => option.letter.toUpperCase()),
        );
        const accepted =
          key.answers[String(question.number)]?.accepted ??
          key.sets.find((set) => set.questions.includes(question.number))?.accepted ??
          [];

        for (const value of accepted) {
          const candidate = value.trim().toUpperCase();
          if (candidate.length === 1 && !letters.has(candidate)) {
            issues.push({
              level: "error",
              code: "unknown_option_letter",
              message: `Question ${question.number} expects option "${candidate}" but it is not among its choices`,
              questionNumber: question.number,
            });
          }
        }
      }
    }
  }
}

const FIXED_CHOICES: Partial<Record<string, string[]>> = {
  tfng: ["TRUE", "FALSE", "NOT GIVEN"],
  ynng: ["YES", "NO", "NOT GIVEN"],
};

/**
 * True/False/Not Given and Yes/No/Not Given answers can only be one of three
 * values, and a typed answer can never legitimately be one of those words. Both
 * directions catch a key whose entries have shifted relative to the content —
 * the self-test cannot, because it grades the key against itself.
 */
function checkFixedChoiceAnswers(
  content: TestContent,
  key: TestAnswerKey,
  issues: ValidationIssue[],
) {
  const allFixedValues = new Set([...FIXED_CHOICES.tfng!, ...FIXED_CHOICES.ynng!]);

  for (const part of content.parts ?? []) {
    for (const group of part.groups) {
      const allowed = FIXED_CHOICES[group.type];
      const numbers = group.bodyHtml
        ? slotNumbersIn(group.bodyHtml)
        : (group.questions ?? []).map((question) => question.number);

      for (const number of numbers) {
        const accepted = key.answers[String(number)]?.accepted ?? [];
        if (accepted.length === 0) continue;

        if (allowed) {
          for (const value of accepted) {
            if (!allowed.includes(value.trim().toUpperCase())) {
              issues.push({
                level: "error",
                code: "fixed_choice_mismatch",
                message: `Question ${number} is ${group.type.toUpperCase()} but its answer is "${value}", not one of ${allowed.join(" / ")}`,
                questionNumber: number,
              });
            }
          }
          continue;
        }

        if (group.type === "completion" || group.type === "short_answer") {
          for (const value of accepted) {
            if (allFixedValues.has(value.trim().toUpperCase())) {
              issues.push({
                level: "error",
                code: "fixed_choice_mismatch",
                message: `Question ${number} expects a typed answer but the key says "${value}", which belongs to a True/False or Yes/No group`,
                questionNumber: number,
              });
            }
          }
        }
      }
    }
  }
}

function checkRubricWordLimits(content: TestContent, issues: ValidationIssue[]) {
  for (const part of content.parts ?? []) {
    for (const group of part.groups) {
      const rubric = stripHtml(group.rubricHtml);
      const implied = WORD_LIMIT_PHRASES.find((entry) => entry.pattern.test(rubric));

      if (implied && group.maxWords === undefined) {
        issues.push({
          level: "warning",
          code: "missing_max_words",
          message: `Group "${group.id}" says "${rubric.match(implied.pattern)?.[0]}" but has no maxWords, so over-length answers will be accepted`,
        });
      }
      if (implied && group.maxWords !== undefined && group.maxWords !== implied.maxWords) {
        issues.push({
          level: "warning",
          code: "max_words_mismatch",
          message: `Group "${group.id}" sets maxWords ${group.maxWords} but its rubric says "${rubric.match(implied.pattern)?.[0]}"`,
        });
      }
    }
  }
}

/**
 * For reading groups whose rubric says the answer comes from the passage, check
 * the accepted answer actually occurs there. Catches the failure mode where a
 * language model paraphrases the passage and silently breaks its own key.
 */
function checkAnswersAppearInPassage(
  content: TestContent,
  key: TestAnswerKey,
  issues: ValidationIssue[],
) {
  if (content.skill !== "reading") return;

  for (const part of content.parts ?? []) {
    if (!part.passageHtml) continue;
    const passage = normalizeAnswer(stripHtml(part.passageHtml));

    for (const group of part.groups) {
      const rubric = stripHtml(group.rubricHtml);
      const wantsVerbatim =
        FROM_PASSAGE.test(rubric) || WORD_LIMIT_PHRASES.some((e) => e.pattern.test(rubric));
      // Letters come from a word bank, not the passage.
      if (!wantsVerbatim || group.wordBank) continue;

      const numbers = group.bodyHtml
        ? slotNumbersIn(group.bodyHtml)
        : (group.questions ?? []).map((question) => question.number);

      for (const number of numbers) {
        const accepted = key.answers[String(number)]?.accepted ?? [];
        if (accepted.length === 0) continue;

        const found = accepted.some((value) => passage.includes(normalizeAnswer(value)));
        if (!found) {
          issues.push({
            level: "warning",
            code: "answer_not_in_passage",
            message: `Question ${number} expects "${accepted[0]}", which does not appear in the part ${part.number} passage`,
            questionNumber: number,
          });
        }
      }
    }
  }
}

function checkAcceptedAnswerSanity(
  content: TestContent,
  key: TestAnswerKey,
  issues: ValidationIssue[],
) {
  for (const [number, entry] of Object.entries(key.answers)) {
    const normalized = entry.accepted.map(normalizeAnswer);
    if (new Set(normalized).size !== normalized.length) {
      issues.push({
        level: "warning",
        code: "redundant_accepted",
        message: `Question ${number} lists accepted answers that normalize to the same value`,
        questionNumber: Number(number),
      });
    }
    if (normalized.some((value) => value.length === 0)) {
      issues.push({
        level: "error",
        code: "empty_accepted",
        message: `Question ${number} has an accepted answer that is empty once normalized`,
        questionNumber: Number(number),
      });
    }
  }

  // An answer longer than its own rubric allows means the key itself is wrong.
  for (const part of content.parts ?? []) {
    for (const group of part.groups) {
      if (group.maxWords === undefined) continue;
      const numbers = group.bodyHtml
        ? slotNumbersIn(group.bodyHtml)
        : (group.questions ?? []).map((question) => question.number);

      for (const number of numbers) {
        const accepted = key.answers[String(number)]?.accepted ?? [];
        if (accepted.length === 0) continue;
        if (accepted.every((value) => countWords(value) > group.maxWords!)) {
          issues.push({
            level: "error",
            code: "accepted_over_word_limit",
            message: `Every accepted answer for question ${number} exceeds the group's ${group.maxWords}-word limit, so it can never be marked correct`,
            questionNumber: number,
          });
        }
      }
    }
  }
}

/**
 * Fills in the key's own answers and grades them with the real grader. Anything
 * short of full marks means the content and the key disagree structurally.
 *
 * Note what this cannot do: a key that is internally consistent but whose
 * answers are attached to the wrong questions still scores full marks here,
 * because it is being graded against itself. The coverage and type checks above
 * are what catch that, which is why this runs last and only once they pass.
 */
function runSelfTest(
  content: TestContent,
  key: TestAnswerKey,
  issues: ValidationIssue[],
): string | undefined {
  if (content.totalQuestions === 0) return undefined;

  const result = gradeSubmission(content, key, perfectSubmission(key));
  const score = `${result.rawScore}/${result.totalQuestions}`;

  if (result.rawScore !== result.totalQuestions) {
    const failed = result.verdicts.filter((verdict) => !verdict.correct);
    issues.push({
      level: "error",
      code: "self_test_failed",
      message: `Grading the answer key against itself scored ${score} instead of full marks. Question${failed.length === 1 ? "" : "s"} ${failed
        .slice(0, 12)
        .map((verdict) => verdict.number)
        .join(", ")}${failed.length > 12 ? "…" : ""} did not mark correct, which means the content and the key disagree.`,
    });

    for (const verdict of failed.slice(0, 12)) {
      issues.push({
        level: "error",
        code: "self_test_question",
        message: verdict.overWordLimit
          ? `Question ${verdict.number}: the key's own answer "${verdict.expected}" breaks the group's word limit`
          : `Question ${verdict.number}: the key's own answer "${verdict.expected}" did not mark correct`,
        questionNumber: verdict.number,
      });
    }
  }

  return score;
}

/** Full check on a pasted test. Everything a publish must satisfy. */
export function validateTestImport(input: unknown): ValidationReport {
  const parsed = testImportSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        level: "error" as const,
        code: "schema",
        message: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      })),
    };
  }

  const { content, answerKey } = parsed.data;
  const issues: ValidationIssue[] = [];

  const graded = content.skill === "listening" || content.skill === "reading";

  if (graded) {
    const covered = checkQuestionCoverage(content, issues);
    checkAnswerKeyCoverage(content, answerKey, issues);
    checkWordBankReferences(content, answerKey, issues);
    checkMcqOptionsMatchKey(content, answerKey, issues);
    checkFixedChoiceAnswers(content, answerKey, issues);
    checkRubricWordLimits(content, issues);
    checkAcceptedAnswerSanity(content, answerKey, issues);
    checkAnswersAppearInPassage(content, answerKey, issues);

    const selfTestScore =
      issues.some((issue) => issue.level === "error")
        ? undefined
        : runSelfTest(content, answerKey, issues);

    return {
      ok: !issues.some((issue) => issue.level === "error"),
      issues,
      parsed: parsed.data,
      stats: {
        skill: content.skill,
        totalQuestions: content.totalQuestions,
        questionsCovered: new Set(covered).size,
        parts: (content.parts ?? []).length,
        groups: (content.parts ?? []).reduce((sum, part) => sum + part.groups.length, 0),
        selfTestScore,
      },
    };
  }

  return {
    ok: true,
    issues,
    parsed: parsed.data,
    stats: {
      skill: content.skill,
      totalQuestions: content.totalQuestions,
      questionsCovered: 0,
      parts: 0,
      groups: 0,
    },
  };
}

/** Formats a report for the CLI conversion scripts. */
export function formatValidationReport(report: ValidationReport, label: string): string {
  const lines: string[] = [];
  const errors = report.issues.filter((issue) => issue.level === "error");
  const warnings = report.issues.filter((issue) => issue.level === "warning");

  lines.push(`${report.ok ? "PASS" : "FAIL"}  ${label}`);

  if (report.stats) {
    const { skill, totalQuestions, questionsCovered, parts, groups, selfTestScore } = report.stats;
    lines.push(
      `      ${skill}, ${totalQuestions} questions (${questionsCovered} covered), ${parts} parts, ${groups} groups` +
        (selfTestScore ? `, self-test ${selfTestScore}` : ""),
    );
  }

  for (const issue of errors) lines.push(`      ERROR  ${issue.message}`);
  for (const issue of warnings) lines.push(`      warn   ${issue.message}`);

  return lines.join("\n");
}
